"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentProfile {
  student_profile_id: number;
  name: string;
  username: string;
  email: string;
  organization: string | null;
  admission_number: string;
  phone: string;
  date_of_birth: string | null;
  admission_date: string | null;
}

interface Enrollment {
  roll_number: string;
  classroom_name: string;
  section_name: string;
  is_active: boolean;
  enrolled_at: string;
}

function getSavedStudent() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedStudent = localStorage.getItem("student_user");

  if (!savedStudent) {
    return {};
  }

  try {
    return JSON.parse(savedStudent);
  } catch {
    return {};
  }
}

function formatValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return value;
}

export default function StudentProfilePage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearStudentSession = useCallback(() => {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return "";
    }

    return token;
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const token = getToken();

        if (!token) {
          return;
        }

        const response = await fetch(
          `${API_BASE}/api/accounts/student/profile/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearStudentSession();
          router.replace("/student/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail || "Unable to load profile."
          );
        }

        if (isMounted) {
          setProfile(result.profile || null);
          setEnrollment(result.enrollment || null);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [clearStudentSession, getToken, router]);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={
            profile?.name ||
            student.name ||
            student.username ||
            "Student"
          }
          organization={
            profile?.organization ||
            student.organization ||
            ""
          }
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Profile
              </h2>

              <p className="text-muted mb-0">
                View your student account and academic details.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading profile...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Student Information
                    </h5>

                    <div className="row g-4">
                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Name
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.name)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Username
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.username)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Email
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.email)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Admission Number
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.admission_number)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Roll Number
                        </div>

                        <div className="fw-semibold">
                          {formatValue(enrollment?.roll_number)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          College / Organization
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.organization)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Phone
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.phone)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Date of Birth
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.date_of_birth)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Admission Date
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.admission_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Academic Information
                    </h5>

                    {enrollment ? (
                      <div className="row g-4">
                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Class
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.classroom_name)}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Section
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.section_name)}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Enrollment Status
                          </div>

                          <div className="fw-semibold">
                            {enrollment.is_active
                              ? "Active"
                              : "Inactive"}
                          </div>
                        </div>

                        <div className="col-md-6 col-xl-4">
                          <div className="text-muted small">
                            Enrolled At
                          </div>

                          <div className="fw-semibold">
                            {formatValue(enrollment.enrolled_at)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted mb-0">
                        No active enrollment found.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
