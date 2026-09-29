"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../teacher/dashboard/dashboard.css";
import "./students.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentProfile {
  admission_number: string;
  phone: string;
}

interface Student {
  id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  profile: StudentProfile | null;
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
  const value = (name || username || "S").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

export default function CollegeAdminStudentsPage() {
  const router = useRouter();
  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [students, setStudents] = useState<Student[]>([]);
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
      throw new Error(result?.detail || "Unable to load students.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadStudents = useCallback(async (query = search) => {
    const url = new URL(`${API_BASE}/api/accounts/college-admin/students/`);
    if (query.trim()) url.searchParams.set("search", query.trim());
    const result = await fetchJson(url.toString());
    setStudents(result.students || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await loadStudents("");
      } catch (err) {
        if (mounted && err instanceof Error && err.message !== "Unauthorized") {
          setError(err.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [loadStudents]);

  const visibleStudents = useMemo(() => {
    if (statusFilter === "active") return students.filter((student) => student.is_active);
    if (statusFilter === "inactive") return students.filter((student) => !student.is_active);
    return students;
  }, [statusFilter, students]);

  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter((student) => student.is_active).length,
    inactive: students.filter((student) => !student.is_active).length,
  }), [students]);

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      setError("");
      setLoading(true);
      await loadStudents(search);
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
      await loadStudents("");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    try {
      setSaving(true);
      setError("");
      await fetchJson(`${API_BASE}/api/accounts/college-admin/students/${student.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !student.is_active }),
      });
      await loadStudents(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard college-admin-students-ui">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />

        <div className="teacher-dashboard-content student-management-page">
          <div className="container-fluid">
            <div className="student-page-header">
              <div>
                <div className="student-page-kicker">STUDENT MANAGEMENT</div>
                <h1>Students</h1>
                <p>Manage student accounts, profiles, enrollment access and account status.</p>
              </div>
              <Link className="student-primary-action" href="/college-admin/students/create">
                <AdminIcon name="add" size={18} />
                <span>Add Student</span>
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="student-summary-grid">
              <div className="student-summary-card">
                <span className="student-summary-icon"><AdminIcon name="students" size={20} /></span>
                <div><small>Students shown</small><strong>{stats.total}</strong></div>
              </div>
              <div className="student-summary-card">
                <span className="student-summary-icon active"><AdminIcon name="status" size={20} /></span>
                <div><small>Active accounts</small><strong>{stats.active}</strong></div>
              </div>
              <div className="student-summary-card">
                <span className="student-summary-icon muted"><AdminIcon name="pending" size={20} /></span>
                <div><small>Inactive accounts</small><strong>{stats.inactive}</strong></div>
              </div>
            </div>

            <section className="student-toolbar-card">
              <form className="student-search-form" onSubmit={handleSearch}>
                <div className="student-search-field">
                  <AdminIcon name="search" size={18} />
                  <input
                    aria-label="Search students"
                    placeholder="Search by name, username, or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <select
                  className="student-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by account status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <button type="submit" className="student-search-button">
                  <AdminIcon name="search" size={17} />
                  Search
                </button>

                {(search || statusFilter !== "all") && (
                  <button type="button" className="student-clear-button" onClick={() => void clearSearch()}>
                    Clear
                  </button>
                )}
              </form>
            </section>

            <section className="student-list-card">
              <div className="student-list-card-header">
                <div>
                  <h2>Student Directory</h2>
                  <p>{visibleStudents.length} {visibleStudents.length === 1 ? "student" : "students"} in the current view</p>
                </div>
              </div>

              {loading ? (
                <div className="student-state-panel">Loading students...</div>
              ) : visibleStudents.length === 0 ? (
                <div className="student-empty-state">
                  <span><AdminIcon name="students" size={28} /></span>
                  <h3>No students found</h3>
                  <p>Try another search or add a new student account.</p>
                  <Link href="/college-admin/students/create">Add Student</Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table student-directory-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Username</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div className="student-person-cell">
                              <span className="student-avatar">{initials(student.name, student.username)}</span>
                              <div>
                                <strong>{student.name || student.username}</strong>
                                <small>Admission No. {student.profile?.admission_number || "-"}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="student-username">@{student.username}</span>
                          </td>
                          <td>
                            <div className="student-contact-cell">
                              <span><AdminIcon name="mail" size={14} />{student.email || "-"}</span>
                              <span><AdminIcon name="phone" size={14} />{student.profile?.phone || "-"}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`student-status-pill ${student.is_active ? "active" : "inactive"}`}>
                              <i />{student.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="student-row-actions">
                              <Link
                                className="student-icon-action"
                                href={`/college-admin/students/${student.id}`}
                                title="View student"
                              >
                                <AdminIcon name="view" size={17} />
                                <span>View</span>
                              </Link>
                              <Link
                                className="student-icon-action"
                                href={`/college-admin/students/${student.id}/edit`}
                                title="Edit student"
                              >
                                <AdminIcon name="edit" size={17} />
                                <span>Edit</span>
                              </Link>
                              <button
                                type="button"
                                className="student-status-action"
                                disabled={saving}
                                onClick={() => void toggleStatus(student)}
                              >
                                {student.is_active ? "Deactivate" : "Activate"}
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
