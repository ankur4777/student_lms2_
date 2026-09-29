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

interface ParentProfile {
  phone: string;
  occupation: string;
}

interface Parent {
  id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  linked_students_count: number;
  profile: ParentProfile | null;
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

export default function CollegeAdminParentsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [parents, setParents] = useState<Parent[]>([]);
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
      throw new Error(result?.detail || "Unable to load parents.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadParents = useCallback(async (query = search) => {
    const url = new URL(
      `${API_BASE}/api/accounts/college-admin/parents/`
    );
    if (query.trim()) {
      url.searchParams.set("search", query.trim());
    }
    const result = await fetchJson(url.toString());
    setParents(result.parents || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await loadParents("");
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
  }, [loadParents]);

  const handleSearch = async () => {
    try {
      setError("");
      setLoading(true);
      await loadParents(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (parent: Parent) => {
    try {
      setSaving(true);
      setError("");
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parents/${parent.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !parent.is_active,
          }),
        }
      );
      await loadParents(search);
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
                <h2 className="fw-bold mb-1">Parents</h2>
                <p className="text-muted mb-0">
                  Manage parents in your institution.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/parents/create"
              >
                Add Parent
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-10">
                    <input
                      className="form-control"
                      placeholder="Search by name, username, or email"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
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
                  Loading parents...
                </div>
              </div>
            ) : parents.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Parents</h5>
                  <p className="text-muted mb-0">
                    Parents created for this college will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email / Phone</th>
                        <th>Status</th>
                        <th>Linked Students</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parents.map((parent) => (
                        <tr key={parent.id}>
                          <td>
                            <div className="fw-semibold">{parent.name}</div>
                            <div className="text-muted small">
                              {parent.profile?.occupation || "-"}
                            </div>
                          </td>
                          <td>{parent.username}</td>
                          <td>
                            <div>{parent.email || "-"}</div>
                            <div className="text-muted small">
                              {parent.profile?.phone || "-"}
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                parent.is_active
                                  ? "badge bg-success"
                                  : "badge bg-secondary"
                              }
                            >
                              {parent.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>{parent.linked_students_count}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/parents/${parent.id}`}
                              >
                                View
                              </Link>
                              <Link
                                className="btn btn-outline-secondary btn-sm"
                                href={`/college-admin/parents/${parent.id}/edit`}
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={saving}
                                onClick={() => toggleStatus(parent)}
                              >
                                {parent.is_active
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
