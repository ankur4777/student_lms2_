"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../../../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const MAX_ASSIGNMENT_MARKS = 9999.99;

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Submission {
  id: number;
  submission_text: string;
  status: "submitted" | "late" | "graded";
  submitted_at: string;
  has_attachment: boolean;
  marks_obtained: string | number | null;
  feedback: string;
  graded_at: string | null;
}

interface StudentItem {
  student_profile_id: number;
  student_name: string;
  username: string;
  roll_number: string;
  submitted: boolean;
  submission: Submission | null;
}

interface AssignmentInfo {
  id: number;
  title: string;
  instructions: string;
  subject_name: string;
  section_name: string;
  classroom_name: string;
  due_date: string;
  due_time: string | null;
}

interface Summary {
  total_students: number;
  submitted: number;
  not_submitted: number;
}

type ApiObject = Record<string, unknown>;

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

function getErrorDetail(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "detail" in result) {
    const detail = (result as ApiObject).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

export default function TeacherAssignmentSubmissionsPage() {
  const router = useRouter();
  const params = useParams();

  const assignmentId = params.assignmentId as string;

  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [assignment, setAssignment] =
    useState<AssignmentInfo | null>(null);

  const [summary, setSummary] = useState<Summary>({
    total_students: 0,
    submitted: 0,
    not_submitted: 0,
  });

  const [students, setStudents] = useState<StudentItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [gradeMarks, setGradeMarks] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [savingGradeId, setSavingGradeId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const clearTeacherSession = useCallback(() => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  }, []);

  const loadSubmissions = useCallback(async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/assignments/teacher/${assignmentId}/submissions/`,
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

      let result: unknown = null;

      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Submissions API returned HTML:",
          text
        );

        throw new Error(
          `Server error (${response.status}). Check Django terminal.`
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorDetail(result, "Unable to load submissions.")
        );
      }

      const data = result as ApiObject;

      setAssignment(data.assignment as AssignmentInfo);
      setSummary(data.summary as Summary);
      setStudents((data.students as StudentItem[]) || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load submissions."
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId, clearTeacherSession, router]);

  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    queueMicrotask(() => {
      void loadSubmissions(token);
    });
  }, [loadSubmissions, router]);

  const statusBadge = (submission: Submission | null) => {
    if (!submission) {
      return (
        <span className="badge bg-secondary">
          Not Submitted
        </span>
      );
    }

    if (submission.status === "graded") {
      return (
        <span className="badge bg-primary">
          Graded
        </span>
      );
    }

    if (submission.status === "late") {
      return (
        <span className="badge bg-danger">
          Late
        </span>
      );
    }

    return (
      <span className="badge bg-success">
        Submitted
      </span>
    );
  };

  const openSubmissionFile = async (submissionId: number) => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_BASE}/api/assignments/teacher/submissions/${submissionId}/attachment/`,
        {
          method: "GET",
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

      if (!response.ok) {
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          const result = await response.json();

          throw new Error(
            getErrorDetail(result, "Unable to open attachment.")
          );
        }

        throw new Error(
          `Unable to open attachment (${response.status}).`
        );
      }

      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);

      const newWindow = window.open(fileUrl, "_blank");

      if (!newWindow) {
        throw new Error(
          "Popup was blocked. Please allow popups for this site."
        );
      }

      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 60000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open attachment."
      );
    }
  };

  const startGrading = (submission: Submission) => {
  setGradingId(submission.id);

  setGradeMarks(
    submission.marks_obtained !== null
      ? String(submission.marks_obtained)
      : ""
  );

  setGradeFeedback(submission.feedback || "");
  setGradeError("");

  setMessage("");
  setError("");
};

const cancelGrading = () => {
  setGradingId(null);
  setGradeMarks("");
  setGradeFeedback("");
  setGradeError("");
};

const getGradeErrorMessage = (result: unknown) => {
  const data = result as ApiObject | null;
  const marksErrors = data?.marks_obtained;

  if (Array.isArray(marksErrors) && marksErrors.length > 0) {
    return String(marksErrors[0]);
  }

  if (typeof marksErrors === "string") {
    return marksErrors;
  }

  return getErrorDetail(result, "Unable to save grade.");
};

const saveGrade = async (submissionId: number) => {
  const token = localStorage.getItem("teacher_access_token");

  if (!token) {
    router.replace("/teacher/login");
    return;
  }

  if (!gradeMarks.trim()) {
    setGradeError("Please enter marks.");
    return;
  }

  const numericMarks = Number(gradeMarks);

  if (!Number.isFinite(numericMarks)) {
    setGradeError("Please enter valid marks.");
    return;
  }

  if (numericMarks < 0) {
    setGradeError("Marks cannot be negative.");
    return;
  }

  if (numericMarks > MAX_ASSIGNMENT_MARKS) {
    setGradeError(`Marks cannot exceed ${MAX_ASSIGNMENT_MARKS}.`);
    return;
  }

  try {
    setSavingGradeId(submissionId);
    setMessage("");
    setError("");
    setGradeError("");

    const response = await fetch(
      `${API_BASE}/api/assignments/teacher/submissions/${submissionId}/grade/`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marks_obtained: numericMarks,
          feedback: gradeFeedback.trim(),
        }),
      }
    );

    if (response.status === 401) {
      clearTeacherSession();
      router.replace("/teacher/login");
      return;
    }

    const contentType = response.headers.get("content-type");

    let result: unknown = null;

    if (contentType?.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      console.error("Grade API returned HTML:", text);

      throw new Error(
        `Server error (${response.status}). Check Django terminal.`
      );
    }

    if (!response.ok) {
      setGradeError(getGradeErrorMessage(result));
      return;
    }

    setMessage("Grade saved successfully.");

    cancelGrading();

    await loadSubmissions(token);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to save grade."
    );
  } finally {
    setSavingGradeId(null);
  }
};

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={teacher.name || teacher.username || "Teacher"}
          organization={teacher.organization || ""}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">

            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div>
                <button
                  type="button"
                  className="btn btn-link px-0 mb-2 text-decoration-none"
                  onClick={() =>
                    router.push("/teacher/assignments")
                  }
                >
                  ← Back to Assignments
                </button>

                <h2 className="fw-bold mb-1">
                  Assignment Submissions
                </h2>

                {assignment && (
                  <p className="text-muted mb-0">
                    {assignment.title}
                  </p>
                )}
              </div>
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

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading submissions...
                </div>
              </div>
            ) : (
              <>
                {assignment && (
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-4">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <div className="small text-muted">
                            Class
                          </div>

                          <div className="fw-semibold">
                            {assignment.classroom_name} -{" "}
                            {assignment.section_name}
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="small text-muted">
                            Subject
                          </div>

                          <div className="fw-semibold">
                            {assignment.subject_name}
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="small text-muted">
                            Due
                          </div>

                          <div className="fw-semibold">
                            {assignment.due_date}
                            {assignment.due_time &&
                              ` at ${assignment.due_time.slice(0, 5)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUMMARY */}
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="text-muted small">
                          Total Students
                        </div>

                        <h3 className="fw-bold mb-0 mt-2">
                          {summary.total_students}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="text-muted small">
                          Submitted
                        </div>

                        <h3 className="fw-bold mb-0 mt-2">
                          {summary.submitted}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="text-muted small">
                          Not Submitted
                        </div>

                        <h3 className="fw-bold mb-0 mt-2">
                          {summary.not_submitted}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STUDENT SUBMISSIONS */}
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">

                    <h5 className="fw-bold mb-4">
                      Student Submissions
                    </h5>

                    {students.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        No enrolled students found.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle">
                          <thead>
                            <tr>
                              <th>Roll No.</th>
                              <th>Student</th>
                              <th>Status</th>
                              <th>Submitted At</th>
                              <th>Answer</th>
                              <th>Marks</th>
                              <th>Feedback</th>
                              <th>Action</th>
                            </tr>
                          </thead>

                          <tbody>
                            {students.map((student) => (
                              <tr key={student.student_profile_id}>
                                <td>
                                  {student.roll_number || "-"}
                                </td>

                                <td>
                                  <div className="fw-semibold">
                                    {student.student_name}
                                  </div>

                                  <div className="small text-muted">
                                    {student.username}
                                  </div>
                                </td>

                                <td>
                                  {statusBadge(
                                    student.submission
                                  )}
                                </td>

                                <td>
                                  {student.submission
                                    ? new Date(
                                      student.submission.submitted_at
                                    ).toLocaleString()
                                    : "-"}
                                </td>

                                <td style={{ minWidth: "220px" }}>
                                  {student.submission
                                    ?.submission_text || "-"}

                                  {student.submission?.has_attachment && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() =>
                                          openSubmissionFile(student.submission!.id)
                                        }
                                      >
                                        View File
                                      </button>
                                    </div>
                                  )}
                                </td>

                                <td>
                                  {student.submission
                                    ?.marks_obtained ?? "-"}
                                </td>

                                <td style={{ minWidth: "180px" }}>
                                  {student.submission
                                    ?.feedback || "-"}
                                </td>

                                <td style={{ minWidth: "260px" }}>
                                  {!student.submission ? (
                                    <span className="text-muted small">
                                      Awaiting submission
                                    </span>
                                  ) : gradingId === student.submission.id ? (
                                    <div>
                                      <div className="mb-2">
                                        <label className="form-label small fw-semibold">
                                          Marks
                                        </label>

                                        <input
                                          type="number"
                                          min="0"
                                          max={MAX_ASSIGNMENT_MARKS}
                                          step="0.01"
                                          className="form-control form-control-sm"
                                          value={gradeMarks}
                                          onChange={(e) =>
                                            setGradeMarks(e.target.value)
                                          }
                                          placeholder="Enter marks"
                                        />

                                        {gradeError && (
                                          <div className="text-danger small mt-1">
                                            {gradeError}
                                          </div>
                                        )}
                                      </div>

                                      <div className="mb-2">
                                        <label className="form-label small fw-semibold">
                                          Feedback
                                        </label>

                                        <textarea
                                          className="form-control form-control-sm"
                                          rows={2}
                                          value={gradeFeedback}
                                          onChange={(e) =>
                                            setGradeFeedback(e.target.value)
                                          }
                                          placeholder="Enter feedback..."
                                        />
                                      </div>

                                      <div className="d-flex gap-2">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          disabled={
                                            savingGradeId === student.submission.id
                                          }
                                          onClick={() =>
                                            saveGrade(student.submission!.id)
                                          }
                                        >
                                          {savingGradeId === student.submission.id
                                            ? "Saving..."
                                            : "Save Grade"}
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm"
                                          disabled={
                                            savingGradeId === student.submission.id
                                          }
                                          onClick={cancelGrading}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={
                                        student.submission.status === "graded"
                                          ? "btn btn-outline-primary btn-sm"
                                          : "btn btn-primary btn-sm"
                                      }
                                      onClick={() =>
                                        startGrading(student.submission!)
                                      }
                                    >
                                      {student.submission.status === "graded"
                                        ? "Edit Grade"
                                        : "Grade"}
                                    </button>
                                  )}
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
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
