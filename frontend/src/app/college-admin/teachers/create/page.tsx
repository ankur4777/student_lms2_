"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

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

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

export default function CollegeAdminCreateTeacherPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/teachers/`,
        {
          method: "POST",
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
            password,
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
        setError(result?.detail || "Unable to create teacher.");
        return;
      }

      router.replace("/college-admin/teachers");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
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
                  onClick={() => router.push("/college-admin/teachers")}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Teachers
                </button>
                <div className="teacher-page-kicker">FACULTY MANAGEMENT</div>
                <h1>Add Teacher</h1>
                <p>Create a faculty account and professional profile for your institution.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit} className="teacher-form-shell">
              <div className="teacher-form-card">
                <section className="teacher-form-section">
                  <div className="teacher-section-heading">
                    <span><AdminIcon name="teachers" size={18} /></span>
                    <div>
                      <h2>Personal Information</h2>
                      <p>Basic identity and contact details for the teacher.</p>
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
                      <p>Employee identity, qualification and joining details.</p>
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
                      <h2>Login Account</h2>
                      <p>Credentials the teacher will use to access the Teacher Portal.</p>
                    </div>
                  </div>

                  <div className="teacher-form-grid">
                    <div className="teacher-form-group">
                      <label htmlFor="username">Username</label>
                      <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                      <small>This username will be used for teacher login.</small>
                    </div>
                    <div className="teacher-form-group">
                      <label htmlFor="password">Password</label>
                      <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    </div>
                    <div className="teacher-form-group">
                      <label htmlFor="confirm-password">Confirm Password</label>
                      <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                    </div>
                  </div>
                </section>

                <div className="teacher-form-actions">
                  <button type="button" className="teacher-form-cancel" onClick={() => router.push("/college-admin/teachers")}>
                    Cancel
                  </button>
                  <button type="submit" className="teacher-form-submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Teacher"}
                  </button>
                </div>
              </div>

              <aside className="teacher-side-card">
                <h3>Before you create the account</h3>
                <ul>
                  <li>Use a unique username and employee ID.</li>
                  <li>Qualification and joining date can be updated later.</li>
                  <li>Subject and section assignments are managed separately.</li>
                  <li>The teacher will sign in with the username and password.</li>
                </ul>
              </aside>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
