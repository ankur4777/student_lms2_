"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../teacher/dashboard/dashboard.css";
import "../teachers.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Assignment {
  id: number;
  subject_name: string;
  classroom_name: string;
  section_name: string;
}

interface TeacherProfile {
  employee_id: string;
  phone: string;
  qualification: string;
  joining_date: string | null;
}

interface Teacher {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  organization: string;
  profile: TeacherProfile | null;
  assignments: Assignment[];
}

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function formatValue(value?: string | null) {
  return value || "-";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string, username: string) {
  const value = (name || username || "T").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

export default function CollegeAdminTeacherDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadTeacher = async () => {
      const token = localStorage.getItem("college_admin_access_token");
      if (!token) {
        router.replace("/college-admin/login");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/teachers/${params.id}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load teacher.");
        }

        if (isMounted) setTeacher(result.teacher || null);
      } catch (err) {
        if (isMounted && err instanceof Error) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadTeacher();
    return () => { isMounted = false; };
  }, [clearSession, params.id, router]);

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
                <button
                  type="button"
                  className="teacher-back-link mb-3"
                  onClick={() => router.push("/college-admin/teachers")}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Teachers
                </button>
                <div className="teacher-page-kicker">FACULTY PROFILE</div>
                <h1>Teacher Details</h1>
                <p>Review account, professional profile and active teaching assignments.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="teacher-state-panel teacher-list-card">Loading teacher...</div>
            ) : teacher ? (
              <>
                <section className="teacher-profile-hero">
                  <div className="teacher-profile-identity">
                    <span className="teacher-profile-avatar">{initials(teacher.name, teacher.username)}</span>
                    <div>
                      <h1>{teacher.name || teacher.username}</h1>
                      <p>@{teacher.username} · Employee ID {teacher.profile?.employee_id || "-"}</p>
                      <div className="teacher-profile-meta">
                        <span className={`teacher-status-pill ${teacher.is_active ? "active" : "inactive"}`}>
                          <i />{teacher.is_active ? "Active account" : "Inactive account"}
                        </span>
                        <span className="teacher-username">{teacher.assignments.length} active {teacher.assignments.length === 1 ? "assignment" : "assignments"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="teacher-profile-actions">
                    <Link className="teacher-secondary-action" href="/college-admin/teachers">
                      <AdminIcon name="back" size={16} />
                      Directory
                    </Link>
                    <Link
                      className="teacher-primary-action"
                      href={`/college-admin/teachers/${teacher.id}/edit`}
                    >
                      <AdminIcon name="edit" size={16} />
                      Edit Teacher
                    </Link>
                  </div>
                </section>

                <div className="teacher-detail-shell">
                  <div>
                    <section className="teacher-detail-card">
                      <div className="teacher-detail-section">
                        <div className="teacher-section-heading">
                          <span><AdminIcon name="teachers" size={18} /></span>
                          <div>
                            <h2>Account Information</h2>
                            <p>Login identity, contact details and account status.</p>
                          </div>
                        </div>

                        <div className="teacher-detail-grid">
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="teachers" size={14} />Full Name</span>
                            <strong>{formatValue(teacher.name)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="teachers" size={14} />Username</span>
                            <strong>@{teacher.username}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="mail" size={14} />Email</span>
                            <strong>{formatValue(teacher.email)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="phone" size={14} />Phone</span>
                            <strong>{formatValue(teacher.profile?.phone)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="classes" size={14} />College</span>
                            <strong>{formatValue(teacher.organization)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="status" size={14} />Account Status</span>
                            <strong>{teacher.is_active ? "Active" : "Inactive"}</strong>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="teacher-detail-card">
                      <div className="teacher-detail-section">
                        <div className="teacher-section-heading">
                          <span><AdminIcon name="documents" size={18} /></span>
                          <div>
                            <h2>Professional Profile</h2>
                            <p>Employment identity and qualification details.</p>
                          </div>
                        </div>

                        <div className="teacher-detail-grid">
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="documents" size={14} />Employee ID</span>
                            <strong>{formatValue(teacher.profile?.employee_id)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="subjects" size={14} />Qualification</span>
                            <strong>{formatValue(teacher.profile?.qualification)}</strong>
                          </div>
                          <div className="teacher-detail-item">
                            <span><AdminIcon name="calendar" size={14} />Joining Date</span>
                            <strong>{formatDate(teacher.profile?.joining_date)}</strong>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="teacher-detail-card">
                      <div className="teacher-detail-section">
                        <div className="teacher-enrollment-banner">
                          <div>
                            <h2>Teaching Assignments</h2>
                            <p>Subjects, classes and sections currently assigned to this teacher.</p>
                          </div>
                          <Link className="teacher-secondary-action" href="/college-admin/teacher-assignments">
                            <AdminIcon name="assignments" size={16} />
                            Manage Assignments
                          </Link>
                        </div>

                        {teacher.assignments.length === 0 ? (
                          <div className="teacher-empty-state">
                            <span><AdminIcon name="assignments" size={26} /></span>
                            <h3>No active assignments</h3>
                            <p>This teacher has not yet been assigned to a subject and section.</p>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table teacher-directory-table align-middle mb-0">
                              <thead>
                                <tr>
                                  <th>Subject</th>
                                  <th>Class</th>
                                  <th>Section</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teacher.assignments.map((assignment) => (
                                  <tr key={assignment.id}>
                                    <td><strong>{assignment.subject_name}</strong></td>
                                    <td>{assignment.classroom_name}</td>
                                    <td>{assignment.section_name}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="teacher-side-card">
                    <h3>Teacher actions</h3>
                    <p>Edit teacher details, manage subject assignments or review teaching activity from the related modules.</p>
                    <div className="d-grid gap-2 mt-3">
                      <Link className="teacher-secondary-action" href={`/college-admin/teachers/${teacher.id}/edit`}>
                        <AdminIcon name="edit" size={16} />
                        Edit Profile
                      </Link>
                      <Link className="teacher-secondary-action" href="/college-admin/teacher-assignments">
                        <AdminIcon name="assignments" size={16} />
                        Assign Subjects
                      </Link>
                      <Link className="teacher-secondary-action" href="/college-admin/live-classes">
                        <AdminIcon name="live" size={16} />
                        Live Classes
                      </Link>
                    </div>
                  </aside>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
