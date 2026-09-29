"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Assignment {
  id: number;
  title: string;
  instructions: string;
  teacher_name: string;
  subject_name: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
  due_date: string;
  due_time: string | null;
  status: string;
  total_eligible_students: number;
  submission_count: number;
  graded_count: number;
}

interface Summary {
  total_students: number;
  submitted: number;
  not_submitted: number;
  graded: number;
}

interface StudentSubmission {
  student_profile_id: number;
  student_name: string;
  username: string;
  roll_number: string;
  status: string;
  submitted_at: string | null;
  marks_obtained: string | null;
  feedback: string;
}

function getSavedAdmin() {
  if (typeof window === "undefined") {
    return {};
  }
  const saved = localStorage.getItem("college_admin_user");
  if (!saved) {
    return {};
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "-";
}

function statusClass(statusValue: string) {
  if (statusValue === "graded") {
    return "badge bg-success";
  }
  if (statusValue === "submitted") {
    return "badge bg-primary";
  }
  if (statusValue === "late") {
    return "badge bg-warning text-dark";
  }
  return "badge bg-secondary";
}

export default function CollegeAdminAssignmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const fetchJson = useCallback(async (url: string) => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || "Unable to load assignment.");
    }
    return result;
  }, [clearSession, router]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await fetchJson(
          `${API_BASE}/api/assignments/college-admin/${params.id}/`
        );
        if (isMounted) {
          setAssignment(result.assignment);
          setSummary(result.summary);
          setStudents(result.students || []);
        }
      } catch (err) {
        if (
          isMounted &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchJson, params.id]);

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">Assignment Detail</h2>
                <p className="text-muted mb-0">
                  Read-only submission monitoring.
                </p>
              </div>
              <Link
                className="btn btn-outline-secondary"
                href="/college-admin/assignments"
              >
                Back
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading assignment...
                </div>
              </div>
            ) : assignment ? (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Assignment Information</h5>
                        <div className="fw-semibold">{assignment.title}</div>
                        <div className="text-muted mt-2">
                          {assignment.instructions || "-"}
                        </div>
                        <div className="mt-3">
                          Due: {assignment.due_date}{" "}
                          {formatTime(assignment.due_time)}
                        </div>
                        <span className="badge bg-info text-dark mt-2">
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Academic Information</h5>
                        <div>Subject: {assignment.subject_name}</div>
                        <div>
                          Class / Section: {assignment.classroom_name} /{" "}
                          {assignment.section_name}
                        </div>
                        <div>
                          Session: {assignment.academic_session_name || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Teacher Information</h5>
                        <div>{assignment.teacher_name}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  {[
                    ["Eligible Students", summary?.total_students ?? 0],
                    ["Submitted", summary?.submitted ?? 0],
                    ["Pending", summary?.not_submitted ?? 0],
                    ["Graded", summary?.graded ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="col-xl-3 col-md-6">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                          <div className="text-muted small">{label}</div>
                          <div className="fs-4 fw-bold">{value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <h5 className="fw-bold mb-3">Student Submissions</h5>
                    {students.length === 0 ? (
                      <div className="text-muted py-4 text-center">
                        No eligible students found.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Username</th>
                              <th>Roll No.</th>
                              <th>Status</th>
                              <th>Submitted At</th>
                              <th>Marks</th>
                              <th>Feedback</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((student) => (
                              <tr key={student.student_profile_id}>
                                <td>{student.student_name}</td>
                                <td>{student.username}</td>
                                <td>{student.roll_number || "-"}</td>
                                <td>
                                  <span className={statusClass(student.status)}>
                                    {student.status}
                                  </span>
                                </td>
                                <td>{student.submitted_at || "-"}</td>
                                <td>{student.marks_obtained ?? "-"}</td>
                                <td>{student.feedback || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Assignment not found.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
