"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

interface Submission {
  id: number;
  status: "submitted" | "late" | "graded";
  submitted_at: string;
  marks_obtained: string | number | null;
  feedback: string;
}

interface Assignment {
  id: number;
  title: string;
  instructions: string;
  due_date: string;
  due_time: string | null;
  created_at: string;

  subject_name: string;
  section_name: string;
  classroom_name: string;
  teacher_name: string;

  has_attachment: boolean;

  submitted: boolean;
  submission: Submission | null;
}

type FilterType =
  | "all"
  | "pending"
  | "submitted"
  | "late"
  | "graded";

export default function StudentAssignmentsPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentUser>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<FilterType>("all");

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [submissionText, setSubmissionText] = useState("");
  const [submissionFile, setSubmissionFile] =
    useState<File | null>(null);

  const [submittingId, setSubmittingId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");
    const savedStudent = localStorage.getItem("student_user");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    if (savedStudent) {
      try {
        setStudent(JSON.parse(savedStudent));
      } catch {
        // Ignore invalid localStorage data.
      }
    }

    loadAssignments(token);
  }, [router]);

  const clearStudentSession = () => {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
  };

  const loadAssignments = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/assignments/student/`,
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

      const contentType = response.headers.get("content-type");

      let result: any = null;

      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Student assignments API returned HTML:",
          text
        );

        throw new Error(
          `Server error (${response.status}). Check the Django terminal.`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load assignments."
        );
      }

      setAssignments(result.assignments || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load assignments."
      );
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentStatus = (
    assignment: Assignment
  ): FilterType => {
    if (!assignment.submitted) {
      return "pending";
    }

    if (assignment.submission?.status === "graded") {
      return "graded";
    }

    if (assignment.submission?.status === "late") {
      return "late";
    }

    return "submitted";
  };

  const filteredAssignments = useMemo(() => {
    if (filter === "all") {
      return assignments;
    }

    return assignments.filter(
      (assignment) =>
        getAssignmentStatus(assignment) === filter
    );
  }, [assignments, filter]);

  const countByStatus = (status: FilterType) => {
    if (status === "all") {
      return assignments.length;
    }

    return assignments.filter(
      (assignment) =>
        getAssignmentStatus(assignment) === status
    ).length;
  };

  const openSubmitForm = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSubmissionText("");
    setSubmissionFile(null);
    setMessage("");
    setError("");

    const fileInput = document.getElementById(
      "student-assignment-file"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const closeSubmitForm = () => {
    setSelectedAssignment(null);
    setSubmissionText("");
    setSubmissionFile(null);
  };

  const handleSubmitAssignment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedAssignment) {
      return;
    }

    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    if (!submissionText.trim() && !submissionFile) {
      setError("Please enter an answer or upload a file.");
      return;
    }

    try {
      setSubmittingId(selectedAssignment.id);
      setMessage("");
      setError("");

      const formData = new FormData();

      formData.append(
        "submission_text",
        submissionText.trim()
      );

      if (submissionFile) {
        formData.append("attachment", submissionFile);
      }

      const response = await fetch(
        `${API_BASE}/api/assignments/student/${selectedAssignment.id}/submit/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.status === 401) {
        clearStudentSession();
        router.replace("/student/login");
        return;
      }

      const contentType = response.headers.get("content-type");

      let result: any = null;

      if (contentType?.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();

        console.error(
          "Assignment submission API returned HTML:",
          text
        );

        throw new Error(
          `Server error (${response.status}). Check the Django terminal.`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Unable to submit assignment."
        );
      }

      setMessage("Assignment submitted successfully.");

      closeSubmitForm();

      await loadAssignments(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit assignment."
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const formatDue = (assignment: Assignment) => {
    if (assignment.due_time) {
      return `${assignment.due_date} at ${assignment.due_time.slice(
        0,
        5
      )}`;
    }

    return assignment.due_date;
  };

  const statusBadge = (assignment: Assignment) => {
    const status = getAssignmentStatus(assignment);

    if (status === "graded") {
      return (
        <span className="badge bg-primary">
          Graded
        </span>
      );
    }

    if (status === "late") {
      return (
        <span className="badge bg-danger">
          Late
        </span>
      );
    }

    if (status === "submitted") {
      return (
        <span className="badge bg-success">
          Submitted
        </span>
      );
    }

    return (
      <span className="badge bg-warning text-dark">
        Pending
      </span>
    );
  };

  const featureRestricted = isClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={student.name || student.username || "Student"}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            {featureRestricted ? (
              <StudentFeatureRestricted featureName="Assignments" />
            ) : (
              <>
                <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Assignments
              </h2>

              <p className="text-muted mb-0">
                View assignments and submit your work.
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

            {/* FILTERS */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">

                  {(
                    [
                      ["all", "All"],
                      ["pending", "Pending"],
                      ["submitted", "Submitted"],
                      ["late", "Late"],
                      ["graded", "Graded"],
                    ] as [FilterType, string][]
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={`btn ${
                        filter === value
                          ? "btn-primary"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => setFilter(value)}
                    >
                      {label}{" "}
                      <span className="ms-1">
                        ({countByStatus(value)})
                      </span>
                    </button>
                  ))}

                </div>
              </div>
            </div>

            {/* ASSIGNMENT LIST */}
            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading assignments...
                </div>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h6>No assignments found</h6>
                  <p className="text-muted mb-0">
                    There are no assignments in this category.
                  </p>
                </div>
              </div>
            ) : (
              <div className="row g-4">
                {filteredAssignments.map((assignment) => (
                  <div
                    className="col-xl-6"
                    key={assignment.id}
                  >
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">

                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <h5 className="fw-bold mb-1">
                              {assignment.title}
                            </h5>

                            <div className="small text-muted">
                              {assignment.classroom_name} -{" "}
                              {assignment.section_name} •{" "}
                              {assignment.subject_name}
                            </div>
                          </div>

                          {statusBadge(assignment)}
                        </div>

                        <div className="small mb-2">
                          <strong>Teacher:</strong>{" "}
                          {assignment.teacher_name}
                        </div>

                        <div className="small mb-3">
                          <strong>Due:</strong>{" "}
                          {formatDue(assignment)}
                        </div>

                        {assignment.instructions && (
                          <div className="bg-light rounded-3 p-3 mb-3">
                            <div className="small fw-semibold mb-1">
                              Instructions
                            </div>

                            <div className="small text-muted">
                              {assignment.instructions}
                            </div>
                          </div>
                        )}

                        <div className="d-flex flex-wrap gap-2 mb-3">
                          {assignment.has_attachment && (
                            <span className="badge text-bg-light">
                              Teacher Attachment
                            </span>
                          )}

                          {assignment.submission && (
                            <span className="badge text-bg-light">
                              Submitted{" "}
                              {new Date(
                                assignment.submission.submitted_at
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {assignment.submission?.status ===
                          "graded" && (
                          <div className="border rounded-3 p-3 mb-3">
                            <div className="fw-semibold mb-2">
                              Result
                            </div>

                            <div className="small mb-2">
                              <strong>Marks:</strong>{" "}
                              {assignment.submission
                                .marks_obtained ?? "-"}
                            </div>

                            {assignment.submission.feedback && (
                              <div className="small">
                                <strong>Feedback:</strong>{" "}
                                {
                                  assignment.submission
                                    .feedback
                                }
                              </div>
                            )}
                          </div>
                        )}

                        {!assignment.submitted ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() =>
                              openSubmitForm(assignment)
                            }
                          >
                            Submit Assignment
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-success"
                            disabled
                          >
                            Submitted
                          </button>
                        )}

                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUBMIT FORM */}
            {selectedAssignment && (
              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body p-4">

                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <h5 className="fw-bold mb-1">
                        Submit Assignment
                      </h5>

                      <p className="text-muted mb-0">
                        {selectedAssignment.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeSubmitForm}
                    />
                  </div>

                  <form onSubmit={handleSubmitAssignment}>
                    <div className="row g-3">

                      <div className="col-12">
                        <label className="form-label">
                          Your Answer
                        </label>

                        <textarea
                          className="form-control"
                          rows={5}
                          value={submissionText}
                          onChange={(e) =>
                            setSubmissionText(
                              e.target.value
                            )
                          }
                          placeholder="Write your answer here..."
                        />

                        <small className="text-muted">
                          You can write an answer, upload a file,
                          or both.
                        </small>
                      </div>

                      <div className="col-12">
                        <label className="form-label">
                          Upload File
                        </label>

                        <input
                          id="student-assignment-file"
                          type="file"
                          className="form-control"
                          onChange={(e) =>
                            setSubmissionFile(
                              e.target.files?.[0] ||
                                null
                            )
                          }
                        />
                      </div>

                      <div className="col-12">
                        <div className="d-flex gap-2">

                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={
                              submittingId ===
                              selectedAssignment.id
                            }
                          >
                            {submittingId ===
                            selectedAssignment.id
                              ? "Submitting..."
                              : "Submit Assignment"}
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={closeSubmitForm}
                            disabled={
                              submittingId ===
                              selectedAssignment.id
                            }
                          >
                            Cancel
                          </button>

                        </div>
                      </div>

                    </div>
                  </form>

                </div>
              </div>
            )}
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}