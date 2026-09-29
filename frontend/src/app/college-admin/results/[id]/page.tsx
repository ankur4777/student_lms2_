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

interface Exam {
  id: number;
  name: string;
  exam_date: string;
  status: string;
  subject_names: string;
  teacher_names: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
}

interface Summary {
  eligible_students: number;
  results_entered: number;
  pending_students: number;
  status: string;
}

interface StudentResult {
  student_profile_id: number;
  student_name: string;
  username: string;
  roll_number: string;
  marks_obtained: number | null;
  maximum_marks: number | null;
  percentage: number | null;
  status: string;
  remarks: string;
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

function statusClass(statusValue: string) {
  if (statusValue === "published" || statusValue === "entered") {
    return "badge bg-success";
  }
  return "badge bg-secondary";
}

function displayValue(value: number | string | null) {
  return value === null || value === "" ? "-" : value;
}

export default function CollegeAdminResultDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [exam, setExam] = useState<Exam | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentResult[]>([]);
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
      throw new Error(result.detail || "Unable to load result.");
    }
    return result;
  }, [clearSession, router]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await fetchJson(
          `${API_BASE}/api/results/college-admin/${params.id}/`
        );
        if (isMounted) {
          setExam(result.exam);
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
                <h2 className="fw-bold mb-1">Result Detail</h2>
                <p className="text-muted mb-0">
                  Read-only exam result monitoring.
                </p>
              </div>
              <Link
                className="btn btn-outline-secondary"
                href="/college-admin/results"
              >
                Back
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading result...
                </div>
              </div>
            ) : exam ? (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Exam Information</h5>
                        <div className="fw-semibold">{exam.name}</div>
                        <div className="mt-2">Exam Date: {exam.exam_date}</div>
                        <span className={statusClass(exam.status)}>
                          {exam.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Academic Information</h5>
                        <div>Subject: {exam.subject_names || "-"}</div>
                        <div>
                          Class / Section: {exam.classroom_name} /{" "}
                          {exam.section_name}
                        </div>
                        <div>Session: {exam.academic_session_name || "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <h5 className="fw-bold">Teacher Information</h5>
                        <div>{exam.teacher_names || "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  {[
                    ["Eligible Students", summary?.eligible_students ?? 0],
                    ["Results Entered", summary?.results_entered ?? 0],
                    ["Pending", summary?.pending_students ?? 0],
                    ["Status", summary?.status ?? "-"],
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
                    <h5 className="fw-bold mb-3">Student Results</h5>
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
                              <th>Marks</th>
                              <th>Total Marks</th>
                              <th>Percentage</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((student) => (
                              <tr key={student.student_profile_id}>
                                <td>{student.student_name}</td>
                                <td>{student.username}</td>
                                <td>{student.roll_number || "-"}</td>
                                <td>{displayValue(student.marks_obtained)}</td>
                                <td>{displayValue(student.maximum_marks)}</td>
                                <td>
                                  {student.percentage === null
                                    ? "-"
                                    : `${student.percentage}%`}
                                </td>
                                <td>
                                  <span className={statusClass(student.status)}>
                                    {student.status}
                                  </span>
                                </td>
                                <td>{student.remarks || "-"}</td>
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
                  Result not found.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
