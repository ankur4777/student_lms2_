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

interface Enrollment {
  enrollment_id: number;
  student_name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
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

export default function CollegeAdminEnrollmentsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
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
        result?.detail || "Unable to load enrollments."
      );
    }

    return result;
  }, [clearSession, getToken, router]);

  const loadEnrollments = useCallback(async (query = search) => {
    const url = new URL(
      `${API_BASE}/api/accounts/college-admin/enrollments/`
    );

    if (query.trim()) {
      url.searchParams.set("search", query.trim());
    }

    const result = await fetchJson(url.toString());
    setEnrollments(result.enrollments || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadEnrollments("");
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
  }, [loadEnrollments]);

  const toggleStatus = async (enrollment: Enrollment) => {
    try {
      setSaving(true);
      setError("");
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/enrollments/${enrollment.enrollment_id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !enrollment.is_active,
          }),
        }
      );
      await loadEnrollments(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    try {
      await loadEnrollments(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
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
                <h2 className="fw-bold mb-1">
                  Student Enrollments
                </h2>
                <p className="text-muted mb-0">
                  Assign students to their academic class and section.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/enrollments/create"
              >
                Enroll Student
              </Link>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-10">
                    <input
                      className="form-control"
                      placeholder="Search student or roll number"
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
                  Loading enrollments...
                </div>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">
                    No Enrollments
                  </h5>
                  <p className="text-muted mb-0">
                    Student enrollments will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Roll Number</th>
                        <th>Academic Session</th>
                        <th>Class</th>
                        <th>Section</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => (
                        <tr key={enrollment.enrollment_id}>
                          <td>
                            <div className="fw-semibold">
                              {enrollment.student_name}
                            </div>
                            <div className="text-muted small">
                              {enrollment.username}
                            </div>
                          </td>
                          <td>{enrollment.roll_number || "-"}</td>
                          <td>{enrollment.academic_session}</td>
                          <td>{enrollment.classroom_name}</td>
                          <td>{enrollment.section_name}</td>
                          <td>
                            <span
                              className={
                                enrollment.is_active
                                  ? "badge bg-success"
                                  : "badge bg-secondary"
                              }
                            >
                              {enrollment.is_active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/enrollments/${enrollment.enrollment_id}/edit`}
                              >
                                View/Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={saving}
                                onClick={() => toggleStatus(enrollment)}
                              >
                                {enrollment.is_active
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
