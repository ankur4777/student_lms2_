"use client";

import { FormEvent, useEffect, useState } from "react";
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

interface TeachingAssignment {
  teacher_assignment_id: number;
  subject_id: number;
  subject_name: string;
  section_id: number;
  section_name: string;
  classroom_name: string;
}

interface Assignment {
  id: number;
  title: string;
  instructions: string;
  due_date: string;
  due_time: string | null;
  is_published: boolean;
  created_at: string;
  assignment_id: number;
  subject_name: string;
  section_name: string;
  classroom_name: string;
  has_attachment: boolean;
  submission_count: number;
}

export default function TeacherAssignmentsPage() {
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherUser>({});
  const [teachingAssignments, setTeachingAssignments] = useState<
    TeachingAssignment[]
  >([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedTeachingAssignment, setSelectedTeachingAssignment] =
    useState("");

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isPublished, setIsPublished] = useState(true);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
const [editTitle, setEditTitle] = useState("");
const [editInstructions, setEditInstructions] = useState("");
const [editDueDate, setEditDueDate] = useState("");
const [editDueTime, setEditDueTime] = useState("");
const [editPublished, setEditPublished] = useState(true);
const [editAttachment, setEditAttachment] = useState<File | null>(null);

const [savingId, setSavingId] = useState<number | null>(null);
const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        // Ignore invalid localStorage data
      }
    }

    loadPageData(token);
  }, [router]);

  const clearTeacherSession = () => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  };

  const loadPageData = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const [setupResponse, assignmentsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/assignments/teacher/setup/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_BASE}/api/assignments/teacher/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (
        setupResponse.status === 401 ||
        assignmentsResponse.status === 401
      ) {
        clearTeacherSession();
        router.replace("/teacher/login");
        return;
      }

      const setupResult = await setupResponse.json();
      const assignmentsResult = await assignmentsResponse.json();

      if (!setupResponse.ok) {
        throw new Error(
          setupResult.detail || "Unable to load teaching assignments."
        );
      }

      if (!assignmentsResponse.ok) {
        throw new Error(
          assignmentsResult.detail || "Unable to load assignments."
        );
      }

      setTeachingAssignments(setupResult.assignments || []);
      setAssignments(assignmentsResult.assignments || []);
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

  const resetForm = () => {
    setSelectedTeachingAssignment("");
    setTitle("");
    setInstructions("");
    setDueDate("");
    setDueTime("");
    setAttachment(null);
    setIsPublished(true);

    const fileInput = document.getElementById(
      "assignment-attachment"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleCreateAssignment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    if (!selectedTeachingAssignment) {
      setError("Please select a class and subject.");
      return;
    }

    if (!title.trim()) {
      setError("Assignment title is required.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");

      const formData = new FormData();

      formData.append(
        "teacher_assignment_id",
        selectedTeachingAssignment
      );

      formData.append("title", title.trim());
      formData.append("instructions", instructions.trim());
      formData.append("due_date", dueDate);

      if (dueTime) {
        formData.append("due_time", dueTime);
      }

      formData.append(
        "is_published",
        isPublished ? "true" : "false"
      );

      if (attachment) {
        formData.append("attachment", attachment);
      }

      const response = await fetch(
        `${API_BASE}/api/assignments/teacher/create/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
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

        console.error("Assignment API returned HTML:", text);

        throw new Error(
          `Server error (${response.status}). Check the Django terminal.`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to create assignment."
        );
      }

      setMessage("Assignment created successfully.");

      resetForm();

      await loadPageData(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create assignment."
      );
    } finally {
      setCreating(false);
    }
  };
  const startEditing = (assignment: Assignment) => {
  setEditingId(assignment.id);
  setEditTitle(assignment.title);
  setEditInstructions(assignment.instructions || "");
  setEditDueDate(assignment.due_date);
  setEditDueTime(
    assignment.due_time
      ? assignment.due_time.slice(0, 5)
      : ""
  );
  setEditPublished(assignment.is_published);
  setEditAttachment(null);

  setMessage("");
  setError("");
};

const cancelEditing = () => {
  setEditingId(null);
  setEditTitle("");
  setEditInstructions("");
  setEditDueDate("");
  setEditDueTime("");
  setEditPublished(true);
  setEditAttachment(null);
};

const handleUpdateAssignment = async (
  assignmentId: number
) => {
  const token = localStorage.getItem("teacher_access_token");

  if (!token) {
    router.replace("/teacher/login");
    return;
  }

  if (!editTitle.trim()) {
    setError("Assignment title is required.");
    return;
  }

  if (!editDueDate) {
    setError("Due date is required.");
    return;
  }

  try {
    setSavingId(assignmentId);
    setMessage("");
    setError("");

    const formData = new FormData();

    formData.append("title", editTitle.trim());
    formData.append(
      "instructions",
      editInstructions.trim()
    );
    formData.append("due_date", editDueDate);

    // Send even when blank so existing time can be removed.
    formData.append("due_time", editDueTime);

    formData.append(
      "is_published",
      editPublished ? "true" : "false"
    );

    if (editAttachment) {
      formData.append(
        "attachment",
        editAttachment
      );
    }

    const response = await fetch(
      `${API_BASE}/api/assignments/teacher/${assignmentId}/`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (response.status === 401) {
      clearTeacherSession();
      router.replace("/teacher/login");
      return;
    }

    const contentType =
      response.headers.get("content-type");

    let result: any = null;

    if (contentType?.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      console.error(
        "Assignment update API returned HTML:",
        text
      );

      throw new Error(
        `Server error (${response.status}). Check the Django terminal.`
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.detail ||
          "Unable to update assignment."
      );
    }

    setMessage(
      "Assignment updated successfully."
    );

    cancelEditing();

    await loadPageData(token);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update assignment."
    );
  } finally {
    setSavingId(null);
  }
};

const handleDeleteAssignment = async (
  assignment: Assignment
) => {
  const confirmed = window.confirm(
    `Delete "${assignment.title}"? This action cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  const token = localStorage.getItem(
    "teacher_access_token"
  );

  if (!token) {
    router.replace("/teacher/login");
    return;
  }

  try {
    setDeletingId(assignment.id);
    setMessage("");
    setError("");

    const response = await fetch(
      `${API_BASE}/api/assignments/teacher/${assignment.id}/`,
      {
        method: "DELETE",
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

    const contentType =
      response.headers.get("content-type");

    let result: any = null;

    if (contentType?.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      console.error(
        "Assignment delete API returned HTML:",
        text
      );

      throw new Error(
        `Server error (${response.status}). Check the Django terminal.`
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.detail ||
          "Unable to delete assignment."
      );
    }

    if (editingId === assignment.id) {
      cancelEditing();
    }

    setMessage(
      "Assignment deleted successfully."
    );

    await loadPageData(token);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to delete assignment."
    );
  } finally {
    setDeletingId(null);
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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Assignments</h2>

              <p className="text-muted mb-0">
                Create and manage assignments for your students.
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

            {/* CREATE ASSIGNMENT */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-4">
                  Create Assignment
                </h5>

                <form onSubmit={handleCreateAssignment}>
                  <div className="row g-3">
                    <div className="col-lg-6">
                      <label className="form-label">
                        Class / Subject
                      </label>

                      <select
                        className="form-select"
                        value={selectedTeachingAssignment}
                        onChange={(e) =>
                          setSelectedTeachingAssignment(
                            e.target.value
                          )
                        }
                        required
                      >
                        <option value="">
                          Select class and subject
                        </option>

                        {teachingAssignments.map((item) => (
                          <option
                            key={item.teacher_assignment_id}
                            value={item.teacher_assignment_id}
                          >
                            {item.classroom_name} -{" "}
                            {item.section_name} -{" "}
                            {item.subject_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-lg-6">
                      <label className="form-label">
                        Assignment Title
                      </label>

                      <input
                        type="text"
                        className="form-control"
                        value={title}
                        onChange={(e) =>
                          setTitle(e.target.value)
                        }
                        placeholder="Enter assignment title"
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">
                        Instructions
                      </label>

                      <textarea
                        className="form-control"
                        rows={4}
                        value={instructions}
                        onChange={(e) =>
                          setInstructions(e.target.value)
                        }
                        placeholder="Enter assignment instructions..."
                      />
                    </div>

                    <div className="col-md-6 col-lg-3">
                      <label className="form-label">
                        Due Date
                      </label>

                      <input
                        type="date"
                        className="form-control"
                        value={dueDate}
                        onChange={(e) =>
                          setDueDate(e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="col-md-6 col-lg-3">
                      <label className="form-label">
                        Due Time
                      </label>

                      <input
                        type="time"
                        className="form-control"
                        value={dueTime}
                        onChange={(e) =>
                          setDueTime(e.target.value)
                        }
                      />
                    </div>

                    <div className="col-lg-6">
                      <label className="form-label">
                        Attachment
                      </label>

                      <input
                        id="assignment-attachment"
                        type="file"
                        className="form-control"
                        onChange={(e) =>
                          setAttachment(
                            e.target.files?.[0] || null
                          )
                        }
                      />

                      <small className="text-muted">
                        Optional assignment file.
                      </small>
                    </div>

                    <div className="col-12">
                      <div className="form-check">
                        <input
                          id="publish-assignment"
                          type="checkbox"
                          className="form-check-input"
                          checked={isPublished}
                          onChange={(e) =>
                            setIsPublished(e.target.checked)
                          }
                        />

                        <label
                          htmlFor="publish-assignment"
                          className="form-check-label"
                        >
                          Publish immediately
                        </label>
                      </div>
                    </div>

                    <div className="col-12">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creating}
                      >
                        {creating
                          ? "Creating..."
                          : "Create Assignment"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* MY ASSIGNMENTS */}
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h5 className="fw-bold mb-1">
                      My Assignments
                    </h5>

                    <p className="text-muted mb-0">
                      {assignments.length} assignment
                      {assignments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="py-4 text-center text-muted">
                    Loading assignments...
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-5">
                    <h6>No assignments yet</h6>

                    <p className="text-muted mb-0">
                      Create your first assignment above.
                    </p>
                  </div>
                ) : (
                  <div className="row g-3">
                    {assignments.map((assignment) => (
  <div
    className="col-xl-6"
    key={assignment.id}
  >
    <div className="border rounded-3 p-3 h-100">

      <div className="d-flex justify-content-between gap-3 mb-2">
        <div>
          <h6 className="fw-bold mb-1">
            {assignment.title}
          </h6>

          <div className="small text-muted">
            {assignment.classroom_name} -{" "}
            {assignment.section_name} •{" "}
            {assignment.subject_name}
          </div>
        </div>

        <span
          className={`badge ${
            assignment.is_published
              ? "bg-success"
              : "bg-secondary"
          }`}
        >
          {assignment.is_published
            ? "Published"
            : "Draft"}
        </span>
      </div>

      {assignment.instructions && (
        <p className="text-muted small mt-3 mb-3">
          {assignment.instructions}
        </p>
      )}

      <div className="small mb-2">
        <strong>Due:</strong>{" "}
        {assignment.due_date}

        {assignment.due_time &&
          ` at ${assignment.due_time.slice(
            0,
            5
          )}`}
      </div>

      <div className="d-flex flex-wrap gap-2 mt-3">
        <span className="badge text-bg-light">
          {assignment.submission_count}{" "}
          submission
          {assignment.submission_count === 1
            ? ""
            : "s"}
        </span>

        {assignment.has_attachment && (
          <span className="badge text-bg-light">
            Attachment
          </span>
        )}
      </div>

      {/* ACTIONS */}
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button
  type="button"
  className="btn btn-outline-dark btn-sm"
  onClick={() =>
    router.push(
      `/teacher/assignments/${assignment.id}/submissions`
    )
  }
>
  View Submissions
</button>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() =>
            startEditing(assignment)
          }
          disabled={
            deletingId === assignment.id
          }
        >
          Edit
        </button>

        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          onClick={() =>
            handleDeleteAssignment(
              assignment
            )
          }
          disabled={
            deletingId === assignment.id ||
            savingId === assignment.id
          }
        >
          {deletingId === assignment.id
            ? "Deleting..."
            : "Delete"}
        </button>
      </div>

      {/* EDIT FORM */}
      {editingId === assignment.id && (
        <div className="border-top mt-4 pt-3">

          <h6 className="fw-bold mb-3">
            Edit Assignment
          </h6>

          <div className="row g-3">

            <div className="col-12">
              <label className="form-label">
                Assignment Title
              </label>

              <input
                type="text"
                className="form-control"
                value={editTitle}
                onChange={(e) =>
                  setEditTitle(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="col-12">
              <label className="form-label">
                Instructions
              </label>

              <textarea
                className="form-control"
                rows={3}
                value={editInstructions}
                onChange={(e) =>
                  setEditInstructions(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Due Date
              </label>

              <input
                type="date"
                className="form-control"
                value={editDueDate}
                onChange={(e) =>
                  setEditDueDate(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Due Time
              </label>

              <input
                type="time"
                className="form-control"
                value={editDueTime}
                onChange={(e) =>
                  setEditDueTime(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="col-12">
              <label className="form-label">
                Replace Attachment
              </label>

              <input
                type="file"
                className="form-control"
                onChange={(e) =>
                  setEditAttachment(
                    e.target.files?.[0] ||
                      null
                  )
                }
              />

              <small className="text-muted">
                Leave empty to keep the
                current attachment.
              </small>
            </div>

            <div className="col-12">
              <div className="form-check">
                <input
                  id={`edit-published-${assignment.id}`}
                  type="checkbox"
                  className="form-check-input"
                  checked={editPublished}
                  onChange={(e) =>
                    setEditPublished(
                      e.target.checked
                    )
                  }
                />

                <label
                  htmlFor={`edit-published-${assignment.id}`}
                  className="form-check-label"
                >
                  Published
                </label>
              </div>
            </div>

            <div className="col-12">
              <div className="d-flex gap-2">

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={
                    savingId ===
                      assignment.id ||
                    !editTitle.trim() ||
                    !editDueDate
                  }
                  onClick={() =>
                    handleUpdateAssignment(
                      assignment.id
                    )
                  }
                >
                  {savingId ===
                  assignment.id
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={cancelEditing}
                  disabled={
                    savingId ===
                    assignment.id
                  }
                >
                  Cancel
                </button>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  </div>
))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}