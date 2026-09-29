"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface AttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
}

interface AttendanceRecord {
  id: number;
  date: string;
  subject_name: string;
  section_name: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: string;
  remarks: string;
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

export default function StudentAttendancePage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    async function loadAttendance() {
      try {
        setLoading(true);
        setError("");

        const [summaryResponse, recordsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/attendance/student/summary/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/attendance/student/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (
          summaryResponse.status === 401 ||
          recordsResponse.status === 401
        ) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return;
        }

        const summaryResult = await summaryResponse.json();
        const recordsResult = await recordsResponse.json();

        if (!summaryResponse.ok) {
          throw new Error(
            summaryResult.detail || "Unable to load attendance summary."
          );
        }

        if (!recordsResponse.ok) {
          throw new Error(
            recordsResult.detail || "Unable to load attendance records."
          );
        }

        setSummary(summaryResult);
        setRecords(recordsResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load attendance."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [router]);

  const featureRestricted = isClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={student.name || student.username || "Student"}
          organization={student.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            {featureRestricted ? (
              <StudentFeatureRestricted featureName="Attendance" />
            ) : (
              <>
                <div className="dashboard-panel mb-4">
              <div className="panel-heading">
                <h5>Attendance</h5>
              </div>

              {loading && (
                <div className="empty-state">Loading attendance...</div>
              )}

              {error && <div className="alert alert-danger">{error}</div>}

              {!loading && !error && summary && (
                <div className="row g-3">
                  {[
                    ["Overall", `${summary.attendance_percentage}%`],
                    ["Total", summary.total_classes],
                    ["Present", summary.present],
                    ["Late", summary.late],
                    ["Absent", summary.absent],
                    ["Excused", summary.excused],
                  ].map(([label, value]) => (
                    <div key={label} className="col-lg-2 col-md-4 col-6">
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted small">{label}</div>
                        <div className="fs-5 fw-bold">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-panel">
              <div className="panel-heading">
                <h5>Attendance Records</h5>
                <span className="badge bg-primary">{records.length}</span>
              </div>

              {!loading && !error && records.length === 0 && (
                <div className="empty-state">No attendance records found.</div>
              )}

              {!loading && !error && records.length > 0 && (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Section</th>
                        <th>Teacher</th>
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
                          <td>{record.section_name}</td>
                          <td>{record.teacher_name || "-"}</td>
                          <td>
                            {record.start_time} - {record.end_time}
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
