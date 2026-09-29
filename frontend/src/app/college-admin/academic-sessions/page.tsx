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

interface AcademicSession {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
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

export default function CollegeAdminAcademicSessionsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
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
        result?.detail || "Unable to load academic sessions."
      );
    }

    return result;
  }, [clearSession, getToken, router]);

  const loadSessions = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/academics/college-admin/academic-sessions/`
    );
    setSessions(result.academic_sessions || []);
  }, [fetchJson]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadSessions();
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
  }, [loadSessions]);

  const toggleStatus = async (session: AcademicSession) => {
    setSaving(true);
    setError("");

    try {
      await fetchJson(
        `${API_BASE}/api/academics/college-admin/academic-sessions/${session.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !session.is_active,
          }),
        }
      );
      await loadSessions();
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
                <h2 className="fw-bold mb-1">Academic Sessions</h2>
                <p className="text-muted mb-0">
                  Manage academic sessions for your institution.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/academic-sessions/create"
              >
                Add Academic Session
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading academic sessions...
                </div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Academic Sessions</h5>
                  <p className="text-muted mb-0">
                    Academic sessions will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Academic Session</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="fw-semibold">{session.name}</td>
                          <td>{session.start_date}</td>
                          <td>{session.end_date}</td>
                          <td>
                            <span
                              className={
                                session.is_active
                                  ? "badge bg-success"
                                  : "badge bg-secondary"
                              }
                            >
                              {session.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/academic-sessions/${session.id}/edit`}
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={saving}
                                onClick={() => toggleStatus(session)}
                              >
                                {session.is_active
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
