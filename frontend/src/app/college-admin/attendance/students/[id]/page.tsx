"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentInfo {
  id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
}

interface Summary {
  total_records: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
}

interface AttendanceRecord {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  topic: string;
  subject_name: string;
  teacher_name: string;
  section_name: string;
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

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "-";
}

export default function CollegeAdminStudentAttendancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStudentAttendance = async () => {
      const token = localStorage.getItem("college_admin_access_token");

      if (!token) {
        router.replace("/college-admin/login");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/attendance/college-admin/students/${params.id}/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail || "Unable to load student attendance."
          );
        }

        if (isMounted) {
          setStudent(result.student);
          setSummary(result.summary);
          setRecords(result.records || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load student attendance."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadStudentAttendance();

    return () => {
      isMounted = false;
    };
  }, [clearSession, params.id, router]);

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
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">Student Attendance</h2>
                <p className="text-muted mb-0">
                  Attendance history for one student.
                </p>
              </div>

              <Link
                href="/college-admin/attendance"
                className="btn btn-outline-secondary"
              >
                Back
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading && (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  Loading student attendance...
                </div>
              </div>
            )}

            {!loading && student && summary && (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-3">
                        <div className="text-muted small">Student</div>
                        <strong>{student.name}</strong>
                        <div className="small text-muted">
                          {student.username}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="text-muted small">Class / Section</div>
                        <strong>
                          {student.classroom_name || "-"} /{" "}
                          {student.section_name || "-"}
                        </strong>
                      </div>
                      <div className="col-md-3">
                        <div className="text-muted small">Roll Number</div>
                        <strong>{student.roll_number || "-"}</strong>
                      </div>
                      <div className="col-md-3">
                        <div className="text-muted small">Academic Session</div>
                        <strong>{student.academic_session_name || "-"}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  {[
                    ["Total", summary.total_records],
                    ["Present", summary.present],
                    ["Absent", summary.absent],
                    ["Late", summary.late],
                    ["Excused", summary.excused],
                    ["Attendance %", `${summary.attendance_percentage}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="col-xl-2 col-md-4 col-6">
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
                    {records.length === 0 ? (
                      <div className="text-center text-muted py-5">
                        No attendance history found.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Subject</th>
                              <th>Teacher</th>
                              <th>Topic</th>
                              <th>Time</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((record) => (
                              <tr key={record.id}>
                                <td>{record.date}</td>
                                <td>{record.subject_name}</td>
                                <td>{record.teacher_name}</td>
                                <td>{record.topic || "-"}</td>
                                <td>
                                  {formatTime(record.start_time)} -{" "}
                                  {formatTime(record.end_time)}
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border">
                                    {record.status}
                                  </span>
                                </td>
                                <td>{record.remarks || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
