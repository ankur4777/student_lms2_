"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../teacher/dashboard/dashboard.css";
import "../students.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentProfile {
  admission_number: string;
  phone: string;
  date_of_birth: string | null;
  admission_date: string | null;
}

interface Student {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  date_joined: string;
  profile: StudentProfile | null;
}

interface Enrollment {
  enrollment_id: number;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  academic_session: string;
  is_active: boolean;
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
  const value = (name || username || "S").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

export default function CollegeAdminStudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStudent = async () => {
      const token = localStorage.getItem("college_admin_access_token");

      if (!token) {
        router.replace("/college-admin/login");
        return;
      }

      try {
        const [studentResponse, enrollmentResponse] = await Promise.all([
          fetch(`${API_BASE}/api/accounts/college-admin/students/${params.id}/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/accounts/college-admin/students/${params.id}/enrollment/`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (studentResponse.status === 401 || enrollmentResponse.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const studentResult = await studentResponse.json();
        const enrollmentResult = await enrollmentResponse.json();

        if (!studentResponse.ok) {
          throw new Error(studentResult?.detail || "Unable to load student.");
        }

        if (!enrollmentResponse.ok) {
          throw new Error(enrollmentResult?.detail || "Unable to load enrollment.");
        }

        if (isMounted) {
          setStudent(studentResult.student || null);
          setEnrollment(enrollmentResult.enrollment || null);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadStudent();

    return () => {
      isMounted = false;
    };
  }, [clearSession, params.id, router]);

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
                <button
                  type="button"
                  className="student-back-link mb-3"
                  onClick={() => router.push("/college-admin/students")}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Students
                </button>
                <div className="student-page-kicker">STUDENT PROFILE</div>
                <h1>Student Details</h1>
                <p>Review account, profile and current enrollment information.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="student-state-panel student-list-card">Loading student...</div>
            ) : student ? (
              <>
                <section className="student-profile-hero">
                  <div className="student-profile-identity">
                    <span className="student-profile-avatar">{initials(student.name, student.username)}</span>
                    <div>
                      <h1>{student.name || student.username}</h1>
                      <p>@{student.username} · Admission No. {student.profile?.admission_number || "-"}</p>
                      <div className="student-profile-meta">
                        <span className={`student-status-pill ${student.is_active ? "active" : "inactive"}`}>
                          <i />{student.is_active ? "Active account" : "Inactive account"}
                        </span>
                        <span className="student-username">Joined {formatDate(student.date_joined)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="student-profile-actions">
                    <Link
                      className="student-secondary-action"
                      href="/college-admin/students"
                    >
                      <AdminIcon name="back" size={16} />
                      Directory
                    </Link>
                    <Link
                      className="student-primary-action"
                      href={`/college-admin/students/${student.id}/edit`}
                    >
                      <AdminIcon name="edit" size={16} />
                      Edit Student
                    </Link>
                  </div>
                </section>

                <div className="student-detail-shell">
                  <div>
                    <section className="student-detail-card">
                      <div className="student-detail-section">
                        <div className="student-section-heading">
                          <span><AdminIcon name="students" size={18} /></span>
                          <div>
                            <h2>Account Information</h2>
                            <p>Login identity and account-level information.</p>
                          </div>
                        </div>

                        <div className="student-detail-grid">
                          <div className="student-detail-item">
                            <span><AdminIcon name="students" size={14} />Full Name</span>
                            <strong>{formatValue(student.name)}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="students" size={14} />Username</span>
                            <strong>@{student.username}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="mail" size={14} />Email</span>
                            <strong>{formatValue(student.email)}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="status" size={14} />Account Status</span>
                            <strong>{student.is_active ? "Active" : "Inactive"}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="calendar" size={14} />Account Created</span>
                            <strong>{formatDate(student.date_joined)}</strong>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="student-detail-card">
                      <div className="student-detail-section">
                        <div className="student-section-heading">
                          <span><AdminIcon name="documents" size={18} /></span>
                          <div>
                            <h2>Student Profile</h2>
                            <p>Admission and personal information stored for this student.</p>
                          </div>
                        </div>

                        <div className="student-detail-grid">
                          <div className="student-detail-item">
                            <span><AdminIcon name="documents" size={14} />Admission Number</span>
                            <strong>{formatValue(student.profile?.admission_number)}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="phone" size={14} />Phone</span>
                            <strong>{formatValue(student.profile?.phone)}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="calendar" size={14} />Date of Birth</span>
                            <strong>{formatDate(student.profile?.date_of_birth)}</strong>
                          </div>
                          <div className="student-detail-item">
                            <span><AdminIcon name="calendar" size={14} />Admission Date</span>
                            <strong>{formatDate(student.profile?.admission_date)}</strong>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="student-detail-card">
                      <div className="student-detail-section">
                        <div className="student-enrollment-banner">
                          <div>
                            <h2>Current Enrollment</h2>
                            <p>Class, section, session and roll number assignment.</p>
                          </div>

                          {enrollment ? (
                            <Link
                              className="student-secondary-action"
                              href={`/college-admin/enrollments/${enrollment.enrollment_id}/edit`}
                            >
                              <AdminIcon name="edit" size={16} />
                              Manage Enrollment
                            </Link>
                          ) : (
                            <Link
                              className="student-primary-action"
                              href={`/college-admin/enrollments/create?student_id=${student.id}`}
                            >
                              <AdminIcon name="add" size={16} />
                              Enroll Student
                            </Link>
                          )}
                        </div>

                        {enrollment ? (
                          <div className="student-detail-grid">
                            <div className="student-detail-item">
                              <span><AdminIcon name="enrollments" size={14} />Roll Number</span>
                              <strong>{formatValue(enrollment.roll_number)}</strong>
                            </div>
                            <div className="student-detail-item">
                              <span><AdminIcon name="calendar" size={14} />Academic Session</span>
                              <strong>{enrollment.academic_session}</strong>
                            </div>
                            <div className="student-detail-item">
                              <span><AdminIcon name="classes" size={14} />Class</span>
                              <strong>{enrollment.classroom_name}</strong>
                            </div>
                            <div className="student-detail-item">
                              <span><AdminIcon name="sections" size={14} />Section</span>
                              <strong>{enrollment.section_name}</strong>
                            </div>
                            <div className="student-detail-item">
                              <span><AdminIcon name="status" size={14} />Enrollment Status</span>
                              <strong>{enrollment.is_active ? "Active" : "Inactive"}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="student-empty-state">
                            <span><AdminIcon name="enrollments" size={26} /></span>
                            <h3>No active enrollment</h3>
                            <p>This student has not yet been assigned to a class and section.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="student-side-card">
                    <h3>Student actions</h3>
                    <p>Use Edit Student to update safe profile fields or change account status. Enrollment is managed separately to keep academic assignments clear.</p>
                    <div className="d-grid gap-2 mt-3">
                      <Link className="student-secondary-action" href={`/college-admin/students/${student.id}/edit`}>
                        <AdminIcon name="edit" size={16} />
                        Edit Profile
                      </Link>
                      <Link className="student-secondary-action" href="/college-admin/fees">
                        <AdminIcon name="fees" size={16} />
                        Open Fees
                      </Link>
                      <Link className="student-secondary-action" href="/college-admin/attendance">
                        <AdminIcon name="attendance" size={16} />
                        Open Attendance
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
