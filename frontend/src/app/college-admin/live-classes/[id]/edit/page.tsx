"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherAssignment {
  assignment_id: number;
  teacher_name: string;
  subject_name: string;
  class_name: string;
  section_name: string;
  academic_session: string;
}

interface LiveClass {
  teacher_assignment_id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
}

function getSavedAdmin() {
  if (typeof window === "undefined") {
    return {};
  }
  const saved = localStorage.getItem("college_admin_user");
  if (!saved) {
    return {};
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function formatTimeInput(value: string) {
  return value ? value.slice(0, 5) : "";
}

export default function CollegeAdminEditLiveClassPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherAssignmentId, setTeacherAssignmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classDate, setClassDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [classStatus, setClassStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isCompleted = classStatus === "completed";

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return "";
    }
    return token;
  }, [router]);

  const fetchJson = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    const token = getToken();
    if (!token) {
      throw new Error("Unauthorized");
    }
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.detail || "Unable to load live class.");
    }
    return result;
  }, [clearSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [setupResult, classResult] = await Promise.all([
          fetchJson(`${API_BASE}/api/live-classes/college-admin/setup/`),
          fetchJson(
            `${API_BASE}/api/live-classes/college-admin/classes/${params.id}/`
          ),
        ]);
        const liveClass = classResult.class as LiveClass;
        if (isMounted) {
          setAssignments(setupResult.teacher_assignments || []);
          setTeacherAssignmentId(String(liveClass.teacher_assignment_id));
          setTitle(liveClass.title || "");
          setDescription(liveClass.description || "");
          setClassDate(liveClass.class_date || "");
          setStartTime(formatTimeInput(liveClass.start_time));
          setEndTime(formatTimeInput(liveClass.end_time));
          setMeetingLink(liveClass.meeting_link || "");
          setClassStatus(liveClass.status || "");
        }
      } catch (err) {
        if (
          isMounted &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchJson, params.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCompleted && startTime && endTime && startTime >= endTime) {
      setError("Start time must be before end time.");
      return;
    }

    setSaving(true);
    setError("");

    const body = isCompleted
      ? {
          title,
          description,
          meeting_link: meetingLink,
        }
      : {
          teacher_assignment: teacherAssignmentId,
          title,
          description,
          class_date: classDate,
          start_time: startTime,
          end_time: endTime,
          meeting_link: meetingLink,
        };

    try {
      await fetchJson(
        `${API_BASE}/api/live-classes/college-admin/classes/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      router.replace(`/college-admin/live-classes/${params.id}`);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Edit Live Class</h2>
              <p className="text-muted mb-0">
                Update safe scheduling fields for this live class.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading live class...
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">
                          Teacher Assignment
                        </label>
                        <select
                          className="form-select"
                          value={teacherAssignmentId}
                          onChange={(event) =>
                            setTeacherAssignmentId(event.target.value)
                          }
                          disabled={isCompleted}
                          required
                        >
                          <option value="">Select teacher assignment</option>
                          {assignments.map((assignment) => (
                            <option
                              key={assignment.assignment_id}
                              value={assignment.assignment_id}
                            >
                              {assignment.teacher_name} -{" "}
                              {assignment.subject_name} -{" "}
                              {assignment.class_name} /{" "}
                              {assignment.section_name}
                              {assignment.academic_session
                                ? ` (${assignment.academic_session})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Title</label>
                        <input
                          className="form-control"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Date</label>
                        <input
                          className="form-control"
                          type="date"
                          value={classDate}
                          onChange={(event) =>
                            setClassDate(event.target.value)
                          }
                          disabled={isCompleted}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Start Time</label>
                        <input
                          className="form-control"
                          type="time"
                          value={startTime}
                          onChange={(event) =>
                            setStartTime(event.target.value)
                          }
                          disabled={isCompleted}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">End Time</label>
                        <input
                          className="form-control"
                          type="time"
                          value={endTime}
                          onChange={(event) =>
                            setEndTime(event.target.value)
                          }
                          disabled={isCompleted}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Meeting Link</label>
                        <input
                          className="form-control"
                          type="url"
                          value={meetingLink}
                          onChange={(event) =>
                            setMeetingLink(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={4}
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          className="btn btn-primary"
                          type="submit"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() =>
                            router.push(
                              `/college-admin/live-classes/${params.id}`
                            )
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
