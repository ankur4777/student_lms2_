"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

interface Enrollment {
  enrollment_id: number;
  academic_session_id: number;
  class_id: number;
  section_id: number;
  student_name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  academic_session: string;
  is_active: boolean;
}

interface AcademicSession {
  id: number;
  name: string;
}

interface ClassRoom {
  id: number;
  name: string;
  academic_session_id: number;
}

interface Section {
  id: number;
  name: string;
  class_id: number;
  academic_session_id: number;
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

export default function EditEnrollmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (item) =>
          !sessionId ||
          item.academic_session_id === Number(sessionId)
      ),
    [classes, sessionId]
  );

  const filteredSections = useMemo(
    () =>
      sections.filter(
        (item) =>
          (!sessionId ||
            item.academic_session_id === Number(sessionId)) &&
          (!classId || item.class_id === Number(classId))
      ),
    [classId, sections, sessionId]
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const token = getToken();
      if (!token) {
        return;
      }
      try {
        const [enrollmentResponse, setupResponse] = await Promise.all([
          fetch(
            `${API_BASE}/api/accounts/college-admin/enrollments/${params.id}/`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
          fetch(
            `${API_BASE}/api/accounts/college-admin/enrollments/setup/`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          ),
        ]);

        if (
          enrollmentResponse.status === 401 ||
          setupResponse.status === 401
        ) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const enrollmentResult = await enrollmentResponse.json();
        const setupResult = await setupResponse.json();

        if (!enrollmentResponse.ok) {
          throw new Error(
            enrollmentResult?.detail || "Unable to load enrollment."
          );
        }

        if (!setupResponse.ok) {
          throw new Error(
            setupResult?.detail || "Unable to load setup data."
          );
        }

        const current = enrollmentResult.enrollment as Enrollment;

        if (isMounted) {
          setEnrollment(current);
          setRollNumber(current.roll_number || "");
          setIsActive(current.is_active);
          setSessions(setupResult.academic_sessions || []);
          setClasses(setupResult.classes || []);
          setSections(setupResult.sections || []);
          setSessionId(String(current.academic_session_id));
          setClassId(String(current.class_id));
          setSectionId(String(current.section_id));
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
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
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const token = getToken();
    if (!token) {
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/enrollments/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            section_id: sectionId,
            roll_number: rollNumber,
            is_active: isActive,
          }),
        }
      );
      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result?.detail || "Unable to update enrollment.");
        return;
      }
      router.replace("/college-admin/enrollments");
    } catch {
      setError("Unable to connect to the server.");
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
              <h2 className="fw-bold mb-1">
                Edit Enrollment
              </h2>
              <p className="text-muted mb-0">
                Update class, section, roll number, and status.
              </p>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading enrollment...
                </div>
              </div>
            ) : enrollment ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="text-muted small">Student</div>
                        <div className="fw-semibold">
                          {enrollment.student_name} ({enrollment.username})
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Academic Session</label>
                        <select
                          className="form-select"
                          value={sessionId}
                          onChange={(event) => {
                            setSessionId(event.target.value);
                            setClassId("");
                            setSectionId("");
                          }}
                          required
                        >
                          <option value="">Select session</option>
                          {sessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Class</label>
                        <select
                          className="form-select"
                          value={classId}
                          onChange={(event) => {
                            setClassId(event.target.value);
                            setSectionId("");
                          }}
                          required
                        >
                          <option value="">Select class</option>
                          {filteredClasses.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Section</label>
                        <select
                          className="form-select"
                          value={sectionId}
                          onChange={(event) =>
                            setSectionId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select section</option>
                          {filteredSections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Roll Number</label>
                        <input
                          className="form-control"
                          value={rollNumber}
                          onChange={(event) =>
                            setRollNumber(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            id="is-active"
                            className="form-check-input"
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) =>
                              setIsActive(event.target.checked)
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="is-active"
                          >
                            Active enrollment
                          </label>
                        </div>
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            router.push("/college-admin/enrollments")
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
