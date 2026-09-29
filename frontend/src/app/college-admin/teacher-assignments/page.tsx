"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  teacher_name: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  section_name: string;
  academic_session: string;
  is_active: boolean;
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

export default function CollegeAdminTeacherAssignmentsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [search, setSearch] = useState("");
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
      throw new Error(
        result?.detail || "Unable to load teacher assignments."
      );
    }

    return result;
  }, [clearSession, getToken, router]);

  const loadAssignments = useCallback(async (query = search) => {
    const url = new URL(
      `${API_BASE}/api/accounts/college-admin/teacher-assignments/`
    );

    if (query.trim()) {
      url.searchParams.set("search", query.trim());
    }

    const result = await fetchJson(url.toString());
    setAssignments(result.assignments || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadAssignments("");
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
  }, [loadAssignments]);

  const handleSearch = async () => {
    setLoading(true);
    setError("");

    try {
      await loadAssignments(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (assignment: TeacherAssignment) => {
    setSaving(true);
    setError("");

    try {
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/teacher-assignments/${assignment.assignment_id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !assignment.is_active,
          }),
        }
      );
      await loadAssignments(search);
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
                <h2 className="fw-bold mb-1">Teacher Assignments</h2>
                <p className="text-muted mb-0">
                  Assign teachers to subjects, classes and sections.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/teacher-assignments/create"
              >
                Add Assignment
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-10">
                    <input
                      className="form-control"
                      placeholder="Search teacher, subject, class or section"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-2 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleSearch}
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading teacher assignments...
                </div>
              </div>
            ) : assignments.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Teacher Assignments</h5>
                  <p className="text-muted mb-0">
                    Teacher assignments will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Teacher</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Section</th>
                        <th>Academic Session</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => (
                        <tr key={assignment.assignment_id}>
                          <td>{assignment.teacher_name}</td>
                          <td>
                            <div className="fw-semibold">
                              {assignment.subject_name}
                            </div>
                            {assignment.subject_code && (
                              <div className="text-muted small">
                                {assignment.subject_code}
                              </div>
                            )}
                          </td>
                          <td>{assignment.class_name}</td>
                          <td>{assignment.section_name}</td>
                          <td>{assignment.academic_session}</td>
                          <td>
                            <span
                              className={
                                assignment.is_active
                                  ? "badge bg-success"
                                  : "badge bg-secondary"
                              }
                            >
                              {assignment.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/teacher-assignments/${assignment.assignment_id}/edit`}
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={saving}
                                onClick={() => toggleStatus(assignment)}
                              >
                                {assignment.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
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
