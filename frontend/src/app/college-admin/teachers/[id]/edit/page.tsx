"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../../teacher/dashboard/dashboard.css";
import "../../teachers.css";

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
  joining_date: string | null;
}

interface Teacher {
  first_name: string;
  last_name: string;
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

export default function CollegeAdminEditTeacherPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const displayName = useMemo(
    () => [firstName, lastName].filter(Boolean).join(" ").trim() || username || "Teacher",
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

    const loadTeacher = async () => {
      const token = getToken();
      if (!token) return;

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

        const teacher = result.teacher as Teacher;

        if (isMounted) {
          setFirstName(teacher.first_name || "");
          setLastName(teacher.last_name || "");
          setUsername(teacher.username || "");
          setEmail(teacher.email || "");
          setEmployeeId(teacher.profile?.employee_id || "");
          setPhone(teacher.profile?.phone || "");
          setQualification(teacher.profile?.qualification || "");
          setJoiningDate(teacher.profile?.joining_date || "");
          setIsActive(teacher.is_active);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadTeacher();
    return () => { isMounted = false; };
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/teachers/${params.id}/`,
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
            employee_id: employeeId,
            phone,
            qualification,
            joining_date: joiningDate || null,
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
        setError(result?.detail || "Unable to update teacher.");
        return;
      }

      router.replace(`/college-admin/teachers/${params.id}`);
    } catch {
      setError("Unable to connect to the server.");
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
                <button
                  type="button"
                  className="teacher-back-link mb-3"
                  onClick={() => router.push(`/college-admin/teachers/${params.id}`)}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Teacher
                </button>
                <div className="teacher-page-kicker">FACULTY MANAGEMENT</div>
                <h1>Edit Teacher</h1>
                <p>Update faculty account and professional profile information.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="teacher-state-panel teacher-list-card">Loading teacher...</div>
            ) : (
              <>
                <section className="teacher-profile-hero">
                  <div className="teacher-profile-identity">
                    <span className="teacher-profile-avatar">{initials(displayName, username)}</span>
                    <div>
                      <h1>{displayName}</h1>
                      <p>@{username || "teacher"} · Employee ID {employeeId || "-"}</p>
                      <div className="teacher-profile-meta">
                        <span className={`teacher-status-pill ${isActive ? "active" : "inactive"}`}>
                          <i />{isActive ? "Active account" : "Inactive account"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <form onSubmit={handleSubmit} className="teacher-form-shell">
                  <div className="teacher-form-card">
                    <section className="teacher-form-section">
                      <div className="teacher-section-heading">
                        <span><AdminIcon name="teachers" size={18} /></span>
                        <div>
                          <h2>Personal Information</h2>
                          <p>Update the teacher&apos;s identity and contact details.</p>
                        </div>
                      </div>

                      <div className="teacher-form-grid">
                        <div className="teacher-form-group">
                          <label htmlFor="first-name">First Name</label>
                          <input id="first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                        </div>
                        <div className="teacher-form-group">
                          <label htmlFor="last-name">Last Name</label>
                          <input id="last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                        </div>
                        <div className="teacher-form-group">
                          <label htmlFor="email">Email</label>
                          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                        <div className="teacher-form-group">
                          <label htmlFor="phone">Phone</label>
                          <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                        </div>
                      </div>
                    </section>

                    <section className="teacher-form-section">
                      <div className="teacher-section-heading">
                        <span><AdminIcon name="documents" size={18} /></span>
                        <div>
                          <h2>Professional Information</h2>
                          <p>Update employee identity, qualification and joining information.</p>
                        </div>
                      </div>

                      <div className="teacher-form-grid">
                        <div className="teacher-form-group">
                          <label htmlFor="employee-id">Employee ID</label>
                          <input id="employee-id" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required />
                        </div>
                        <div className="teacher-form-group">
                          <label htmlFor="qualification">Qualification</label>
                          <input id="qualification" value={qualification} onChange={(event) => setQualification(event.target.value)} />
                        </div>
                        <div className="teacher-form-group">
                          <label htmlFor="joining-date">Joining Date</label>
                          <input id="joining-date" type="date" value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} />
                        </div>
                      </div>
                    </section>

                    <section className="teacher-form-section">
                      <div className="teacher-section-heading">
                        <span><AdminIcon name="enrollments" size={18} /></span>
                        <div>
                          <h2>Account Access</h2>
                          <p>Update login identity and control Teacher Portal access.</p>
                        </div>
                      </div>

                      <div className="teacher-form-grid mb-3">
                        <div className="teacher-form-group">
                          <label htmlFor="username">Username</label>
                          <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                        </div>
                      </div>

                      <div className="teacher-active-switch">
                        <div>
                          <strong>Active teacher account</strong>
                          <small>Inactive teachers cannot use the account until it is reactivated.</small>
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

                    <div className="teacher-form-actions">
                      <button
                        type="button"
                        className="teacher-form-cancel"
                        onClick={() => router.push(`/college-admin/teachers/${params.id}`)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="teacher-form-submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>

                  <aside className="teacher-side-card">
                    <h3>Editing guidance</h3>
                    <ul>
                      <li>Changing username affects the teacher&apos;s login name.</li>
                      <li>Employee ID should remain unique to this teacher.</li>
                      <li>Teaching assignments are managed from Teacher Assignments.</li>
                      <li>Use the account switch only when portal access should be disabled.</li>
                    </ul>

                    <button
                      type="button"
                      className="teacher-secondary-action w-100 mt-3"
                      onClick={() => router.push(`/college-admin/teachers/${params.id}`)}
                    >
                      <AdminIcon name="view" size={16} />
                      View Teacher Profile
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
