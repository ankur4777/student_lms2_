"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon from "@/components/college-admin/AdminIcon";

import "../../../teacher/dashboard/dashboard.css";
import "../students.css";

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

export default function CollegeAdminCreateStudentPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
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
        `${API_BASE}/api/accounts/college-admin/students/`,
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
            phone,
            admission_number: admissionNumber,
            date_of_birth: dateOfBirth || null,
            admission_date: admissionDate || null,
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
        setError(result?.detail || "Unable to create student.");
        return;
      }

      router.replace("/college-admin/students");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
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
                  onClick={() => router.push("/college-admin/students")}
                >
                  <AdminIcon name="back" size={17} />
                  Back to Students
                </button>
                <div className="student-page-kicker">STUDENT MANAGEMENT</div>
                <h1>Add Student</h1>
                <p>Create a student account and admission profile for your institution.</p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handleSubmit} className="student-form-shell">
              <div className="student-form-card">
                <section className="student-form-section">
                  <div className="student-section-heading">
                    <span><AdminIcon name="students" size={18} /></span>
                    <div>
                      <h2>Personal Information</h2>
                      <p>Basic identity and contact details for the student.</p>
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
                      <p>Login credentials and college admission information.</p>
                    </div>
                  </div>

                  <div className="student-form-grid">
                    <div className="student-form-group">
                      <label htmlFor="username">Username</label>
                      <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                      <small>This username will be used for student login.</small>
                    </div>
                    <div className="student-form-group">
                      <label htmlFor="admission-number">Admission Number</label>
                      <input id="admission-number" value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} required />
                    </div>
                    <div className="student-form-group">
                      <label htmlFor="password">Password</label>
                      <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                    </div>
                    <div className="student-form-group">
                      <label htmlFor="confirm-password">Confirm Password</label>
                      <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                    </div>
                  </div>
                </section>

                <div className="student-form-actions">
                  <button type="button" className="student-form-cancel" onClick={() => router.push("/college-admin/students")}>
                    Cancel
                  </button>
                  <button type="submit" className="student-form-submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Student"}
                  </button>
                </div>
              </div>

              <aside className="student-side-card">
                <h3>Before you create the account</h3>
                <ul>
                  <li>Use a unique username and admission number.</li>
                  <li>Email and phone are optional, but useful for contact.</li>
                  <li>You can assign class and section enrollment after the account is created.</li>
                  <li>The student will use the username and password to sign in.</li>
                </ul>
              </aside>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
