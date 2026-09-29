"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherAssignment {
  assignment_id: number;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
}

interface LiveClass {
  id: number;
  title: string;
  teacher_name: string;
  teacher_id: number;
  subject_name: string;
  subject_id: number;
  class_name: string;
  section_name: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  can_edit: boolean;
  can_cancel: boolean;
  recording: {
    exists: boolean;
    is_available: boolean;
  };
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

function statusClass(status: string) {
  if (status === "scheduled") {
    return "badge bg-primary";
  }
  if (status === "live") {
    return "badge bg-success";
  }
  if (status === "completed") {
    return "badge bg-secondary";
  }
  return "badge bg-danger";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTime(value: string) {
  return value ? value.slice(0, 5) : "-";
}

export default function CollegeAdminLiveClassesPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [teacher, setTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const teachers = useMemo(() => {
    const items = new Map<number, string>();
    assignments.forEach((assignment) => {
      items.set(assignment.teacher_id, assignment.teacher_name);
    });
    return Array.from(items, ([id, name]) => ({ id, name }));
  }, [assignments]);

  const subjects = useMemo(() => {
    const items = new Map<number, string>();
    assignments.forEach((assignment) => {
      items.set(assignment.subject_id, assignment.subject_name);
    });
    return Array.from(items, ([id, name]) => ({ id, name }));
  }, [assignments]);

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
      throw new Error(result?.detail || "Unable to load live classes.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadSetup = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/live-classes/college-admin/setup/`
    );
    setAssignments(result.teacher_assignments || []);
  }, [fetchJson]);

  const loadClasses = useCallback(async () => {
    const url = new URL(
      `${API_BASE}/api/live-classes/college-admin/classes/`
    );
    if (status) {
      url.searchParams.set("status", status);
    }
    if (date) {
      url.searchParams.set("date", date);
    }
    if (teacher) {
      url.searchParams.set("teacher", teacher);
    }
    if (subject) {
      url.searchParams.set("subject", subject);
    }
    if (search.trim()) {
      url.searchParams.set("search", search.trim());
    }
    const result = await fetchJson(url.toString());
    setClasses(result.classes || []);
  }, [date, fetchJson, search, status, subject, teacher]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await Promise.all([
          loadSetup(),
          loadClasses(),
        ]);
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
  }, [loadClasses, loadSetup]);

  const applyFilters = async () => {
    setLoading(true);
    setError("");
    try {
      await loadClasses();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelClass = async (item: LiveClass) => {
    setSaving(true);
    setError("");
    try {
      await fetchJson(
        `${API_BASE}/api/live-classes/college-admin/classes/${item.id}/cancel/`,
        {
          method: "POST",
        }
      );
      await loadClasses();
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
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">Live Classes</h2>
                <p className="text-muted mb-0">
                  Manage scheduled live classes for your institution.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/live-classes/create"
              >
                Schedule Live Class
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <input
                      className="form-control"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={teacher}
                      onChange={(event) => setTeacher(event.target.value)}
                    >
                      <option value="">All teachers</option>
                      {teachers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      <option value="">All subjects</option>
                      {subjects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <input
                      className="form-control"
                      placeholder="Search title"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-md-1 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={applyFilters}
                    >
                      Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading live classes...
                </div>
              </div>
            ) : classes.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Live Classes</h5>
                  <p className="text-muted mb-0">
                    Scheduled live classes will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Teacher</th>
                        <th>Subject</th>
                        <th>Class / Section</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Recording</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="fw-semibold">{item.title}</div>
                            {item.meeting_link && (
                              <div className="text-muted small">
                                Meeting link set
                              </div>
                            )}
                          </td>
                          <td>{item.teacher_name}</td>
                          <td>{item.subject_name}</td>
                          <td>
                            {item.class_name} / {item.section_name}
                          </td>
                          <td>{item.class_date}</td>
                          <td>
                            {formatTime(item.start_time)} -{" "}
                            {formatTime(item.end_time)}
                          </td>
                          <td>
                            <span className={statusClass(item.status)}>
                              {formatStatus(item.status)}
                            </span>
                          </td>
                          <td>
                            {item.recording.exists ? (
                              <span
                                className={
                                  item.recording.is_available
                                    ? "badge bg-success"
                                    : "badge bg-secondary"
                                }
                              >
                                {item.recording.is_available
                                  ? "Available"
                                  : "Unavailable"}
                              </span>
                            ) : (
                              <span className="badge bg-light text-dark">
                                None
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/live-classes/${item.id}`}
                              >
                                View
                              </Link>
                              {item.can_edit && (
                                <Link
                                  className="btn btn-outline-secondary btn-sm"
                                  href={`/college-admin/live-classes/${item.id}/edit`}
                                >
                                  Edit
                                </Link>
                              )}
                              {item.can_cancel && (
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  disabled={saving}
                                  onClick={() => cancelClass(item)}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
