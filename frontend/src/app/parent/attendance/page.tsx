"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import ParentFeatureRestricted, { isParentClassFeatureRestricted } from "@/components/parent/ParentFeatureRestricted";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

interface AttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attended_classes: number;
  attendance_percentage: number;
}

interface AttendanceRecord {
  id: number;
  date: string;
  start_time: string;
  subject_name: string;
  teacher_name: string;
  status: string;
  remarks: string;
}

interface StudentInfo {
  id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

export default function ParentAttendancePage() {
  const router = useRouter();

  const [parent, setParent] = useState<ParentUser>({});
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    const savedParent = localStorage.getItem("parent_user");

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    if (savedParent) {
      try {
        setParent(JSON.parse(savedParent));
      } catch {
        // ignore invalid storage
      }
    }

    loadChildren(token);
  }, [router]);

  const clearParentSession = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
  };

  const loadChildren = async (token: string) => {
    try {
      setLoadingChildren(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/accounts/parent/children/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load children."
        );
      }

      const childList = result.children || [];

      setChildren(childList);

      if (childList.length === 1) {
        const childId = String(
          childList[0].student_profile_id
        );

        setSelectedChildId(childId);

        await loadAttendance(token, childId);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load children."
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  const loadAttendance = async (
    token: string,
    childId: string
  ) => {
    try {
      setLoadingAttendance(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/attendance/parent/student/${childId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to load attendance."
        );
      }

      setStudent(result.student || null);
      setSummary(result.summary || null);
      setRecords(result.records || []);
    } catch (err) {
      setStudent(null);
      setSummary(null);
      setRecords([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance."
      );
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleChildChange = async (
    childId: string
  ) => {
    setSelectedChildId(childId);
    setStudent(null);
    setSummary(null);
    setRecords([]);
    setError("");

    if (!childId) {
      return;
    }

    const token = localStorage.getItem(
      "parent_access_token"
    );

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    await loadAttendance(token, childId);
  };

  const getStatusBadge = (statusValue: string) => {
    const status = statusValue.toLowerCase();

    if (status === "present") {
      return "bg-success";
    }

    if (status === "absent") {
      return "bg-danger";
    }

    if (status === "late") {
      return "bg-warning text-dark";
    }

    if (status === "excused") {
      return "bg-info text-dark";
    }

    return "bg-secondary";
  };

  const selectedChild = children.find(
    (child) => String(child.student_profile_id) === selectedChildId
  );
  const featureRestricted = isParentClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={
            parent.name ||
            parent.username ||
            "Parent"
          }
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Attendance
              </h2>

              <p className="text-muted mb-0">
                View your child's attendance summary and records.
              </p>
            </div>

            {error && !featureRestricted && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">

                <div className="row align-items-end">

                  <div className="col-md-6">
                    <label className="form-label">
                      Select Child
                    </label>

                    <select
                      className="form-select"
                      value={selectedChildId}
                      disabled={loadingChildren}
                      onChange={(e) =>
                        handleChildChange(e.target.value)
                      }
                    >
                      <option value="">
                        {loadingChildren
                          ? "Loading children..."
                          : "Select child"}
                      </option>

                      {children.map((child) => (
                        <option
                          key={child.student_profile_id}
                          value={child.student_profile_id}
                        >
                          {child.name} -{" "}
                          {child.classroom_name}{" "}
                          {child.section_name}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>
            </div>

            {featureRestricted && (
              <ParentFeatureRestricted
                featureName="Attendance"
                childName={selectedChild?.name}
              />
            )}

            {featureRestricted ? null : loadingAttendance ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading attendance...
                </div>
              </div>
            ) : selectedChildId && student && summary ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">

                    <div className="row g-3">

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Student
                        </div>

                        <div className="fw-bold">
                          {student.name}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Roll Number
                        </div>

                        <div className="fw-bold">
                          {student.roll_number || "-"}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Class
                        </div>

                        <div className="fw-bold">
                          {student.classroom_name}
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="text-muted small">
                          Section
                        </div>

                        <div className="fw-bold">
                          {student.section_name}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

                <div className="row g-4 mb-4">

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Attendance
                        </div>

                        <h3 className="fw-bold mb-0">
                          {summary.attendance_percentage}%
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Present
                        </div>

                        <h3 className="fw-bold mb-0">
                          {summary.present}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Absent
                        </div>

                        <h3 className="fw-bold mb-0">
                          {summary.absent}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Total Classes
                        </div>

                        <h3 className="fw-bold mb-0">
                          {summary.total_classes}
                        </h3>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="row g-4 mb-4">

                  <div className="col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">

                        <div className="text-muted small mb-2">
                          Late
                        </div>

                        <h4 className="fw-bold mb-0">
                          {summary.late}
                        </h4>

                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">

                        <div className="text-muted small mb-2">
                          Excused
                        </div>

                        <h4 className="fw-bold mb-0">
                          {summary.excused}
                        </h4>

                      </div>
                    </div>
                  </div>

                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">

                    <h5 className="fw-bold mb-4">
                      Attendance History
                    </h5>

                    {records.length === 0 ? (
                      <div className="text-center text-muted py-4">
                        No attendance records found.
                      </div>
                    ) : (
                      <div className="table-responsive">

                        <table className="table align-middle">

                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Subject</th>
                              <th>Teacher</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>

                          <tbody>
                            {records.map((record) => (
                              <tr key={record.id}>

                                <td>
                                  {record.date}
                                </td>

                                <td className="fw-semibold">
                                  {record.subject_name || "-"}
                                </td>

                                <td>
                                  {record.teacher_name || "-"}
                                </td>

                                <td>
                                  <span
                                    className={`badge ${getStatusBadge(
                                      record.status
                                    )}`}
                                  >
                                    {record.status}
                                  </span>
                                </td>

                                <td>
                                  {record.remarks || "-"}
                                </td>

                              </tr>
                            ))}
                          </tbody>

                        </table>

                      </div>
                    )}

                  </div>
                </div>
              </>
            ) : !loadingChildren &&
              children.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">

                  <h5 className="fw-bold">
                    No Linked Students
                  </h5>

                  <p className="text-muted mb-0">
                    No student is currently linked to this parent account.
                  </p>

                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Select a child to view attendance.
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}