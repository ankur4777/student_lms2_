"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../dashboard/dashboard.css";

type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused";

interface Student {
  student_profile_id: number;
  username: string;
  name: string;
  roll_number: string;
}

interface Assignment {
  assignment_id: number;
  subject_id: number;
  subject_name: string;
  section_id: number;
  section_name: string;
  classroom_name: string;
  students: Student[];
}

interface AttendanceValue {
  status: AttendanceStatus;
  remarks: string;
}

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

export default function TeacherAttendancePage() {
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherUser>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedAssignment, setSelectedAssignment] =
    useState<number | null>(null);

  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [attendance, setAttendance] = useState<
    Record<number, AttendanceValue>
  >({});

  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);

  const [existingSession, setExistingSession] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const activeAssignment = assignments.find(
    (item) => item.assignment_id === selectedAssignment
  );

  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");
    const savedTeacher = localStorage.getItem("teacher_user");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (savedTeacher) {
      try {
        setTeacher(JSON.parse(savedTeacher));
      } catch {
        // Ignore invalid local storage data
      }
    }

    loadSetup(token);
  }, [router]);

  const clearTeacherSession = () => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  };

  const loadSetup = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/attendance/teacher/setup/`,
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
          result.detail || "Unable to load attendance setup."
        );
      }

      setAssignments(result.assignments || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance setup."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendance = async (
    assignmentId: number,
    date: string
  ) => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (!assignmentId || !date) {
      return;
    }

    try {
      setLoadingSession(true);
      setMessage("");
      setError("");

      const response = await fetch(
        `${API_BASE}/api/attendance/teacher/session/?assignment_id=${assignmentId}&date=${date}`,
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

      const contentType = response.headers.get("content-type");

      let result: any = null;

      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Attendance session API returned HTML:",
          text
        );

        throw new Error(
          `Server error (${response.status}). Check the Django terminal for details.`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to load existing attendance."
        );
      }

      const assignment = assignments.find(
        (item) => item.assignment_id === assignmentId
      );

      if (!assignment) {
        setAttendance({});
        setExistingSession(false);
        return;
      }

      const values: Record<number, AttendanceValue> = {};

      assignment.students.forEach((student) => {
        values[student.student_profile_id] = {
          status: "present",
          remarks: "",
        };
      });

      if (result.exists) {
        result.attendance.forEach(
          (record: {
            student_profile_id: number;
            status: AttendanceStatus;
            remarks: string;
          }) => {
            values[record.student_profile_id] = {
              status: record.status,
              remarks: record.remarks || "",
            };
          }
        );

        setExistingSession(true);
      } else {
        setExistingSession(false);
      }

      setAttendance(values);
    } catch (err) {
      setExistingSession(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load existing attendance."
      );
    } finally {
      setLoadingSession(false);
    }
  };

  const handleAssignmentChange = (value: string) => {
    if (!value) {
      setSelectedAssignment(null);
      setAttendance({});
      setExistingSession(false);
      setMessage("");
      setError("");
      return;
    }

    const assignmentId = Number(value);

    setSelectedAssignment(assignmentId);
    setExistingSession(false);
    setMessage("");
    setError("");

    loadExistingAttendance(
      assignmentId,
      attendanceDate
    );
  };

  const handleDateChange = (date: string) => {
    setAttendanceDate(date);
    setMessage("");
    setError("");
    setExistingSession(false);

    if (selectedAssignment && date) {
      loadExistingAttendance(
        selectedAssignment,
        date
      );
    }
  };

  const updateStudentStatus = (
    studentId: number,
    status: AttendanceStatus
  ) => {
    setAttendance((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] || {
          remarks: "",
        }),
        status,
      },
    }));
  };

  const updateRemarks = (
    studentId: number,
    remarks: string
  ) => {
    setAttendance((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] || {
          status: "present",
        }),
        remarks,
      },
    }));
  };

  const markAllPresent = () => {
    if (!activeAssignment) {
      return;
    }

    const updated: Record<number, AttendanceValue> = {};

    activeAssignment.students.forEach((student) => {
      updated[student.student_profile_id] = {
        status: "present",
        remarks:
          attendance[student.student_profile_id]?.remarks || "",
      };
    });

    setAttendance(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (!selectedAssignment) {
      setError("Please select a class.");
      return;
    }

    if (!attendanceDate) {
      setError("Please select an attendance date.");
      return;
    }

    if (!activeAssignment) {
      setError(
        "Selected teaching assignment was not found."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const attendanceRecords =
        activeAssignment.students.map((student) => {
          const value =
            attendance[student.student_profile_id];

          return {
            student_profile_id:
              student.student_profile_id,
            status: value?.status || "present",
            remarks: value?.remarks || "",
          };
        });

      const response = await fetch(
        `${API_BASE}/api/attendance/teacher/save/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignment_id: selectedAssignment,
            date: attendanceDate,
            attendance: attendanceRecords,
          }),
        }
      );

      if (response.status === 401) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const contentType = response.headers.get("content-type");

      let result: any = null;

      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Attendance API returned HTML:",
          text
        );

        throw new Error(
          `Server error (${response.status}). Check the Django terminal for details.`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to save attendance."
        );
      }

      setMessage(
        existingSession
          ? `Attendance updated successfully for ${result.records_saved} students.`
          : `Attendance saved successfully for ${result.records_saved} students.`
      );

      setExistingSession(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={
            teacher.name ||
            teacher.username ||
            "Teacher"
          }
          organization={
            teacher.organization || ""
          }
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Attendance
              </h2>

              <p className="text-muted mb-0">
                Mark attendance for your assigned classes.
              </p>
            </div>

            {message && (
              <div className="alert alert-success">
                {message}
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">

                <div className="row g-3">

                  <div className="col-lg-8">
                    <label className="form-label">
                      Class / Subject
                    </label>

                    <select
                      className="form-select"
                      value={
                        selectedAssignment ?? ""
                      }
                      onChange={(e) =>
                        handleAssignmentChange(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select class
                      </option>

                      {assignments.map(
                        (assignment) => (
                          <option
                            key={
                              assignment.assignment_id
                            }
                            value={
                              assignment.assignment_id
                            }
                          >
                            {
                              assignment.classroom_name
                            }
                            {" - "}
                            {
                              assignment.section_name
                            }
                            {" - "}
                            {
                              assignment.subject_name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="col-lg-4">
                    <label className="form-label">
                      Date
                    </label>

                    <input
                      type="date"
                      className="form-control"
                      value={attendanceDate}
                      onChange={(e) =>
                        handleDateChange(
                          e.target.value
                        )
                      }
                    />
                  </div>

                </div>
              </div>
            </div>

            {loading && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  Loading students...
                </div>
              </div>
            )}

            {!loading && activeAssignment && (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">

                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">

                    <div>
                      <h5 className="fw-bold mb-1">
                        {
                          activeAssignment.subject_name
                        }
                      </h5>

                      <div className="text-muted">
                        {
                          activeAssignment.classroom_name
                        }
                        {" - "}
                        {
                          activeAssignment.section_name
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm"
                      onClick={markAllPresent}
                      disabled={loadingSession}
                    >
                      Mark All Present
                    </button>

                  </div>

                  {loadingSession && (
                    <div className="alert alert-info py-2">
                      Loading attendance...
                    </div>
                  )}

                  {!loadingSession &&
                    existingSession && (
                      <div className="alert alert-warning py-2">
                        Attendance already exists for
                        this date. You can update it
                        and save again.
                      </div>
                    )}

                  {activeAssignment.students.length ===
                  0 ? (
                    <div className="text-center py-4">
                      <h6>No students found</h6>

                      <p className="text-muted mb-0">
                        No active students are enrolled
                        in this section.
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive">

                      <table className="table align-middle">
                        <thead>
                          <tr>
                            <th>Roll No.</th>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>

                        <tbody>
                          {activeAssignment.students.map(
                            (student) => {
                              const value =
                                attendance[
                                  student
                                    .student_profile_id
                                ];

                              return (
                                <tr
                                  key={
                                    student.student_profile_id
                                  }
                                >
                                  <td>
                                    {student.roll_number ||
                                      "-"}
                                  </td>

                                  <td>
                                    <strong>
                                      {student.name}
                                    </strong>

                                    <div className="small text-muted">
                                      {student.username}
                                    </div>
                                  </td>

                                  <td>
                                    <select
                                      className="form-select"
                                      value={
                                        value?.status ||
                                        "present"
                                      }
                                      disabled={
                                        loadingSession
                                      }
                                      onChange={(e) =>
                                        updateStudentStatus(
                                          student.student_profile_id,
                                          e.target
                                            .value as AttendanceStatus
                                        )
                                      }
                                    >
                                      <option value="present">
                                        Present
                                      </option>

                                      <option value="absent">
                                        Absent
                                      </option>

                                      <option value="late">
                                        Late
                                      </option>

                                      <option value="excused">
                                        Excused
                                      </option>
                                    </select>
                                  </td>

                                  <td>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Optional"
                                      disabled={
                                        loadingSession
                                      }
                                      value={
                                        value?.remarks ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        updateRemarks(
                                          student.student_profile_id,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>

                    </div>
                  )}

                  {activeAssignment.students.length >
                    0 && (
                    <div className="text-end mt-4">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={
                          saving ||
                          loadingSession
                        }
                      >
                        {saving
                          ? "Saving..."
                          : existingSession
                          ? "Update Attendance"
                          : "Save Attendance"}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}