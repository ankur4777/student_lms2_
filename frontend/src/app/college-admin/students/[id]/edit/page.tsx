"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../../teacher/dashboard/dashboard.css";
import "../../students.css";

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
  first_name: string;
  last_name: string;
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

export default function CollegeAdminEditStudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const displayName = useMemo(
    () => [firstName, lastName].filter(Boolean).join(" ").trim() || username || "Student",
    [firstName, lastName, username]
  );

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

  useEffect(() => {
    let isMounted = true;

    const loadStudent = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/students/${params.id}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load student.");
        }

        const student = result.student as Student;

        if (isMounted) {
          setFirstName(student.first_name || "");
          setLastName(student.last_name || "");
          setUsername(student.username || "");
          setEmail(student.email || "");
          setPhone(student.profile?.phone || "");
          setAdmissionNumber(student.profile?.admission_number || "");
          setDateOfBirth(student.profile?.date_of_birth || "");
          setAdmissionDate(student.profile?.admission_date || "");
          setIsActive(student.is_active);
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
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/students/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            username,
            email,
            phone,
            admission_number: admissionNumber,
            date_of_birth: dateOfBirth || null,
            admission_date: admissionDate || null,
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
        setError(result?.detail || "Unable to update student.");
        return;
      }

      router.replace(`/college-admin/students/${params.id}`);
    } catch {
      setError("Unable to connect to the server.");
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
                <button
                  type="button"
                  className="student-back-link mb-3"
                  onClick={() => router.push(`/college-admin/students/${params.id}`)}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Student
                </button>
                <div className="student-page-kicker">STUDENT MANAGEMENT</div>
                <h1>Edit Student</h1>
                <p>Update account and profile information without changing academic enrollment.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="student-state-panel student-list-card">Loading student...</div>
            ) : (
              <>
                <section className="student-profile-hero">
                  <div className="student-profile-identity">
                    <span className="student-profile-avatar">{initials(displayName, username)}</span>
                    <div>
                      <h1>{displayName}</h1>
                      <p>@{username || "student"} · Admission No. {admissionNumber || "-"}</p>
                      <div className="student-profile-meta">
                        <span className={`student-status-pill ${isActive ? "active" : "inactive"}`}>
                          <i />{isActive ? "Active account" : "Inactive account"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <form onSubmit={handleSubmit} className="student-form-shell">
                  <div className="student-form-card">
                    <section className="student-form-section">
                      <div className="student-section-heading">
                        <span><AdminIcon name="students" size={18} /></span>
                        <div>
                          <h2>Personal Information</h2>
                          <p>Update the student&apos;s identity and contact details.</p>
                        </div>
                      </div>

                      <div className="student-form-grid">
                        <div className="student-form-group">
                          <label htmlFor="first-name">First Name</label>
                          <input id="first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="last-name">Last Name</label>
                          <input id="last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="email">Email</label>
                          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="phone">Phone</label>
                          <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="dob">Date of Birth</label>
                          <input id="dob" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="admission-date">Admission Date</label>
                          <input id="admission-date" type="date" value={admissionDate} onChange={(event) => setAdmissionDate(event.target.value)} />
                        </div>
                      </div>
                    </section>

                    <section className="student-form-section">
                      <div className="student-section-heading">
                        <span><AdminIcon name="enrollments" size={18} /></span>
                        <div>
                          <h2>Account & Admission</h2>
                          <p>Update login identity, admission number and account access.</p>
                        </div>
                      </div>

                      <div className="student-form-grid mb-3">
                        <div className="student-form-group">
                          <label htmlFor="username">Username</label>
                          <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                        </div>
                        <div className="student-form-group">
                          <label htmlFor="admission-number">Admission Number</label>
                          <input id="admission-number" value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} required />
                        </div>
                      </div>

                      <div className="student-active-switch">
                        <div>
                          <strong>Active student account</strong>
                          <small>Inactive students cannot use the account until it is reactivated.</small>
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            id="is-active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) => setIsActive(event.target.checked)}
                          />
                        </div>
                      </div>
                    </section>

                    <div className="student-form-actions">
                      <button
                        type="button"
                        className="student-form-cancel"
                        onClick={() => router.push(`/college-admin/students/${params.id}`)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="student-form-submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  <aside className="student-side-card">
                    <h3>Editing guidance</h3>
                    <ul>
                      <li>Changing username affects the student&apos;s login name.</li>
                      <li>Admission number should remain unique to the student.</li>
                      <li>Class, section and roll number are managed from Enrollment.</li>
                      <li>Use the account switch only when access should be temporarily disabled.</li>
                    </ul>

                    <button
                      type="button"
                      className="student-secondary-action w-100 mt-3"
                      onClick={() => router.push(`/college-admin/students/${params.id}`)}
                    >
                      <AdminIcon name="view" size={16} />
                      View Student Profile
                    </button>
                  </aside>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
