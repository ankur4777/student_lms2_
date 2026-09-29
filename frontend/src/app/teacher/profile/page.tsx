"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherProfile {
  teacher_profile_id: number;
  name: string;
  username: string;
  email: string;
  organization: string | null;
  employee_id: string;
  phone: string;
  qualification: string;
  joining_date: string | null;
}

interface TeacherAssignment {
  teacher_assignment_id: number;
  subject_name: string;
  subject_code: string;
  classroom_name: string;
  section_name: string;
  academic_session: string;
}

interface Summary {
  active_assignments: number;
}

function getSavedTeacher() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedTeacher = localStorage.getItem("teacher_user");

  if (!savedTeacher) {
    return {};
  }

  try {
    return JSON.parse(savedTeacher);
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

export default function TeacherProfilePage() {
  const router = useRouter();

  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [summary, setSummary] = useState<Summary>({
    active_assignments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearTeacherSession = useCallback(() => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
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
          `${API_BASE}/api/accounts/teacher/profile/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearTeacherSession();
          router.replace("/teacher/login");
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
          setAssignments(result.assignments || []);
          setSummary(
            result.summary || {
              active_assignments: 0,
            }
          );
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
  }, [clearTeacherSession, getToken, router]);

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={
            profile?.name ||
            teacher.name ||
            teacher.username ||
            "Teacher"
          }
          organization={
            profile?.organization ||
            teacher.organization ||
            ""
          }
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Profile
              </h2>

              <p className="text-muted mb-0">
                View your teacher account and academic assignments.
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
                <div className="row g-4 mb-4">
                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Active Assignments
                        </div>

                        <h3 className="fw-bold mb-0">
                          {summary.active_assignments}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Teacher Information
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
                          Employee ID
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.employee_id)}
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
                          College / Organization
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.organization)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Qualification
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.qualification)}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Joining Date
                        </div>

                        <div className="fw-semibold">
                          {formatValue(profile?.joining_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Teaching Assignments
                    </h5>

                    {assignments.length === 0 ? (
                      <p className="text-muted mb-0">
                        No active teaching assignments found.
                      </p>
                    ) : (
                      <div className="row g-4">
                        {assignments.map((assignment) => (
                          <div
                            className="col-md-6"
                            key={assignment.teacher_assignment_id}
                          >
                            <div className="border rounded p-3 h-100">
                              <h6 className="fw-bold mb-3">
                                {assignment.subject_name}
                              </h6>

                              <div className="row g-3">
                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Subject Code
                                  </div>

                                  <div className="fw-semibold">
                                    {formatValue(
                                      assignment.subject_code
                                    )}
                                  </div>
                                </div>

                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Class
                                  </div>

                                  <div className="fw-semibold">
                                    {formatValue(
                                      assignment.classroom_name
                                    )}
                                  </div>
                                </div>

                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Section
                                  </div>

                                  <div className="fw-semibold">
                                    {formatValue(
                                      assignment.section_name
                                    )}
                                  </div>
                                </div>

                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Academic Session
                                  </div>

                                  <div className="fw-semibold">
                                    {formatValue(
                                      assignment.academic_session
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
