"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../teacher/dashboard/dashboard.css";
import "./teachers.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherProfile {
  employee_id: string;
  phone: string;
  qualification: string;
}

interface Teacher {
  id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  profile: TeacherProfile | null;
}

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function initials(name: string, username: string) {
  const value = (name || username || "T").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

export default function CollegeAdminTeachersPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const fetchJson = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    if (!token) throw new Error("Unauthorized");

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
      throw new Error(result?.detail || "Unable to load teachers.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadTeachers = useCallback(async (query = search) => {
    const url = new URL(`${API_BASE}/api/accounts/college-admin/teachers/`);
    if (query.trim()) url.searchParams.set("search", query.trim());
    const result = await fetchJson(url.toString());
    setTeachers(result.teachers || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await loadTeachers("");
      } catch (err) {
        if (mounted && err instanceof Error && err.message !== "Unauthorized") setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [loadTeachers]);

  const visibleTeachers = useMemo(() => {
    if (statusFilter === "active") return teachers.filter((teacher) => teacher.is_active);
    if (statusFilter === "inactive") return teachers.filter((teacher) => !teacher.is_active);
    return teachers;
  }, [statusFilter, teachers]);

  const stats = useMemo(() => ({
    total: teachers.length,
    active: teachers.filter((teacher) => teacher.is_active).length,
    inactive: teachers.filter((teacher) => !teacher.is_active).length,
  }), [teachers]);

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      setError("");
      setLoading(true);
      await loadTeachers(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = async () => {
    setSearch("");
    setStatusFilter("all");
    try {
      setLoading(true);
      await loadTeachers("");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (teacher: Teacher) => {
    try {
      setSaving(true);
      setError("");
      await fetchJson(`${API_BASE}/api/accounts/college-admin/teachers/${teacher.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !teacher.is_active }),
      });
      await loadTeachers(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard college-admin-teachers-ui">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />

        <div className="teacher-dashboard-content teacher-management-page">
          <div className="container-fluid">
            <div className="teacher-page-header">
              <div>
                <div className="teacher-page-kicker">FACULTY MANAGEMENT</div>
                <h1>Teachers</h1>
                <p>Manage faculty accounts, professional profiles, assignments and account status.</p>
              </div>
              <Link className="teacher-primary-action" href="/college-admin/teachers/create">
                <AdminIcon name="add" size={18} />
                <span>Add Teacher</span>
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="teacher-summary-grid">
              <div className="teacher-summary-card">
                <span className="teacher-summary-icon"><AdminIcon name="teachers" size={20} /></span>
                <div><small>Teachers shown</small><strong>{stats.total}</strong></div>
              </div>
              <div className="teacher-summary-card">
                <span className="teacher-summary-icon active"><AdminIcon name="status" size={20} /></span>
                <div><small>Active accounts</small><strong>{stats.active}</strong></div>
              </div>
              <div className="teacher-summary-card">
                <span className="teacher-summary-icon muted"><AdminIcon name="pending" size={20} /></span>
                <div><small>Inactive accounts</small><strong>{stats.inactive}</strong></div>
              </div>
            </div>

            <section className="teacher-toolbar-card">
              <form className="teacher-search-form" onSubmit={handleSearch}>
                <div className="teacher-search-field">
                  <AdminIcon name="search" size={18} />
                  <input
                    aria-label="Search teachers"
                    placeholder="Search by name, username, or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <select
                  className="teacher-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by account status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <button type="submit" className="teacher-search-button">
                  <AdminIcon name="search" size={17} />
                  Search
                </button>

                {(search || statusFilter !== "all") && (
                  <button type="button" className="teacher-clear-button" onClick={() => void clearSearch()}>
                    Clear
                  </button>
                )}
              </form>
            </section>

            <section className="teacher-list-card">
              <div className="teacher-list-card-header">
                <div>
                  <h2>Faculty Directory</h2>
                  <p>{visibleTeachers.length} {visibleTeachers.length === 1 ? "teacher" : "teachers"} in the current view</p>
                </div>
              </div>

              {loading ? (
                <div className="teacher-state-panel">Loading teachers...</div>
              ) : visibleTeachers.length === 0 ? (
                <div className="teacher-empty-state">
                  <span><AdminIcon name="teachers" size={28} /></span>
                  <h3>No teachers found</h3>
                  <p>Try another search or add a new teacher account.</p>
                  <Link href="/college-admin/teachers/create">Add Teacher</Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table teacher-directory-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Teacher</th>
                        <th>Username</th>
                        <th>Contact</th>
                        <th>Qualification</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTeachers.map((teacher) => (
                        <tr key={teacher.id}>
                          <td>
                            <div className="teacher-person-cell">
                              <span className="teacher-avatar">{initials(teacher.name, teacher.username)}</span>
                              <div>
                                <strong>{teacher.name || teacher.username}</strong>
                                <small>Employee ID {teacher.profile?.employee_id || "-"}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="teacher-username">@{teacher.username}</span>
                          </td>
                          <td>
                            <div className="teacher-contact-cell">
                              <span><AdminIcon name="mail" size={14} />{teacher.email || "-"}</span>
                              <span><AdminIcon name="phone" size={14} />{teacher.profile?.phone || "-"}</span>
                            </div>
                          </td>
                          <td>
                            <span className="teacher-qualification">{teacher.profile?.qualification || "-"}</span>
                          </td>
                          <td>
                            <span className={`teacher-status-pill ${teacher.is_active ? "active" : "inactive"}`}>
                              <i />{teacher.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="teacher-row-actions">
                              <Link
                                className="teacher-icon-action"
                                href={`/college-admin/teachers/${teacher.id}`}
                                title="View teacher"
                              >
                                <AdminIcon name="view" size={17} />
                                <span>View</span>
                              </Link>
                              <Link
                                className="teacher-icon-action"
                                href={`/college-admin/teachers/${teacher.id}/edit`}
                                title="Edit teacher"
                              >
                                <AdminIcon name="edit" size={17} />
                                <span>Edit</span>
                              </Link>
                              <button
                                type="button"
                                className="teacher-status-action"
                                disabled={saving}
                                onClick={() => void toggleStatus(teacher)}
                              >
                                {teacher.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
