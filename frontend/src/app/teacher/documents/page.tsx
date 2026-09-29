"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const DOCUMENT_TYPES = [
  { value: "notes", label: "Notes" },
  { value: "syllabus", label: "Syllabus" },
  { value: "timetable", label: "Timetable" },
  { value: "study_material", label: "Study Material" },
  { value: "worksheet", label: "Worksheet" },
  { value: "notice", label: "Notice" },
  { value: "other", label: "Other" },
];

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherAssignment {
  teacher_assignment_id: number;
  subject_name: string;
  classroom_name: string;
  section_name: string;
}

interface DocumentItem {
  id: number;
  title: string;
  description: string;
  document_type: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  subject_name: string;
  classroom_name: string;
  section_name: string;
  filename: string;
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

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatType(type: string) {
  return (
    DOCUMENT_TYPES.find((item) => item.value === type)?.label ||
    type
  );
}

export default function TeacherDocumentsPage() {
  const router = useRouter();

  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [teacherAssignmentId, setTeacherAssignmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("notes");
  const [isPublished, setIsPublished] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("notes");

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

  const fetchJson = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    const token = getToken();

    if (!token) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      clearTeacherSession();
      router.replace("/teacher/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Unable to process document request."
      );
    }

    return result;
  }, [clearTeacherSession, getToken, router]);

  const loadDocuments = useCallback(async () => {
    const [setupResult, documentResult] = await Promise.all([
      fetchJson(`${API_BASE}/api/documents/teacher/setup/`),
      fetchJson(`${API_BASE}/api/documents/teacher/`),
    ]);

    setAssignments(setupResult.assignments || []);
    setDocuments(documentResult.documents || []);
  }, [fetchJson]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadDocuments();
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
  }, [loadDocuments]);

  const resetUploadForm = () => {
    setTeacherAssignmentId("");
    setTitle("");
    setDescription("");
    setDocumentType("notes");
    setIsPublished(false);
    setFile(null);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Please choose a file.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("teacher_assignment_id", teacherAssignmentId);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("document_type", documentType);
      formData.append("is_published", String(isPublished));
      formData.append("file", file);

      await fetchJson(`${API_BASE}/api/documents/teacher/upload/`, {
        method: "POST",
        body: formData,
      });

      await loadDocuments();
      resetUploadForm();
      setSuccess("Document uploaded successfully.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (document: DocumentItem) => {
    setEditingId(document.id);
    setEditTitle(document.title);
    setEditDescription(document.description);
    setEditType(document.document_type);
    setError("");
    setSuccess("");
  };

  const saveEdit = async (documentId: number) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await fetchJson(`${API_BASE}/api/documents/teacher/${documentId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          document_type: editType,
        }),
      });

      await loadDocuments();
      setEditingId(null);
      setSuccess("Document updated successfully.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (document: DocumentItem) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await fetchJson(`${API_BASE}/api/documents/teacher/${document.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_published: !document.is_published,
        }),
      });

      await loadDocuments();
      setSuccess("Document status updated.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (documentId: number) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await fetchJson(`${API_BASE}/api/documents/teacher/${documentId}/`, {
        method: "DELETE",
      });

      await loadDocuments();
      setSuccess("Document deleted successfully.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const downloadDocument = async (document: DocumentItem) => {
    try {
      setSaving(true);
      setError("");

      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/documents/teacher/${document.id}/download/`,
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

      if (!response.ok) {
        setError("Unable to download document.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename || document.title;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
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
              <h2 className="fw-bold mb-1">
                Documents
              </h2>

              <p className="text-muted mb-0">
                Upload and manage secure class documents.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                {success}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading documents...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Upload Document
                    </h5>

                    {assignments.length === 0 ? (
                      <p className="text-muted mb-0">
                        No active teaching assignments found.
                      </p>
                    ) : (
                      <form onSubmit={handleUpload}>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">
                              Class / Subject / Section
                            </label>

                            <select
                              className="form-select"
                              value={teacherAssignmentId}
                              onChange={(event) =>
                                setTeacherAssignmentId(event.target.value)
                              }
                              required
                            >
                              <option value="">
                                Select assignment
                              </option>

                              {assignments.map((assignment) => (
                                <option
                                  key={assignment.teacher_assignment_id}
                                  value={assignment.teacher_assignment_id}
                                >
                                  {assignment.classroom_name}{" "}
                                  {assignment.section_name} -{" "}
                                  {assignment.subject_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label">
                              Title
                            </label>

                            <input
                              className="form-control"
                              value={title}
                              onChange={(event) =>
                                setTitle(event.target.value)
                              }
                              required
                            />
                          </div>

                          <div className="col-md-6">
                            <label className="form-label">
                              Document Type
                            </label>

                            <select
                              className="form-select"
                              value={documentType}
                              onChange={(event) =>
                                setDocumentType(event.target.value)
                              }
                            >
                              {DOCUMENT_TYPES.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label">
                              File
                            </label>

                            <input
                              className="form-control"
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                              onChange={(event) =>
                                setFile(event.target.files?.[0] || null)
                              }
                              required
                            />
                          </div>

                          <div className="col-12">
                            <label className="form-label">
                              Description
                            </label>

                            <textarea
                              className="form-control"
                              rows={3}
                              value={description}
                              onChange={(event) =>
                                setDescription(event.target.value)
                              }
                            />
                          </div>

                          <div className="col-12">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                id="publish-document"
                                type="checkbox"
                                checked={isPublished}
                                onChange={(event) =>
                                  setIsPublished(event.target.checked)
                                }
                              />

                              <label
                                className="form-check-label"
                                htmlFor="publish-document"
                              >
                                Publish now
                              </label>
                            </div>
                          </div>

                          <div className="col-12">
                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={saving}
                            >
                              {saving ? "Uploading..." : "Upload"}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      My Documents
                    </h5>

                    {documents.length === 0 ? (
                      <p className="text-muted mb-0">
                        No documents uploaded yet.
                      </p>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {documents.map((document) => (
                          <div
                            className="border rounded p-3"
                            key={document.id}
                          >
                            {editingId === document.id ? (
                              <div className="row g-3">
                                <div className="col-md-6">
                                  <label className="form-label">
                                    Title
                                  </label>

                                  <input
                                    className="form-control"
                                    value={editTitle}
                                    onChange={(event) =>
                                      setEditTitle(event.target.value)
                                    }
                                  />
                                </div>

                                <div className="col-md-6">
                                  <label className="form-label">
                                    Type
                                  </label>

                                  <select
                                    className="form-select"
                                    value={editType}
                                    onChange={(event) =>
                                      setEditType(event.target.value)
                                    }
                                  >
                                    {DOCUMENT_TYPES.map((item) => (
                                      <option
                                        key={item.value}
                                        value={item.value}
                                      >
                                        {item.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="col-12">
                                  <label className="form-label">
                                    Description
                                  </label>

                                  <textarea
                                    className="form-control"
                                    rows={3}
                                    value={editDescription}
                                    onChange={(event) =>
                                      setEditDescription(event.target.value)
                                    }
                                  />
                                </div>

                                <div className="col-12 d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={saving}
                                    onClick={() => saveEdit(document.id)}
                                  >
                                    Save
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                                  <div>
                                    <h6 className="fw-bold mb-1">
                                      {document.title}
                                    </h6>

                                    <div className="text-muted">
                                      {formatType(document.document_type)} -{" "}
                                      {document.subject_name}
                                    </div>
                                  </div>

                                  <span
                                    className={
                                      document.is_published
                                        ? "badge bg-success"
                                        : "badge bg-secondary"
                                    }
                                  >
                                    {document.is_published
                                      ? "Published"
                                      : "Draft"}
                                  </span>
                                </div>

                                <div className="row g-3 mb-3">
                                  <div className="col-md-3">
                                    <div className="text-muted small">
                                      Class
                                    </div>

                                    <div className="fw-semibold">
                                      {document.classroom_name}
                                    </div>
                                  </div>

                                  <div className="col-md-3">
                                    <div className="text-muted small">
                                      Section
                                    </div>

                                    <div className="fw-semibold">
                                      {document.section_name}
                                    </div>
                                  </div>

                                  <div className="col-md-3">
                                    <div className="text-muted small">
                                      File
                                    </div>

                                    <div className="fw-semibold">
                                      {document.filename || "-"}
                                    </div>
                                  </div>

                                  <div className="col-md-3">
                                    <div className="text-muted small">
                                      Uploaded
                                    </div>

                                    <div className="fw-semibold">
                                      {formatDate(document.created_at)}
                                    </div>
                                  </div>
                                </div>

                                {document.description && (
                                  <p className="text-muted">
                                    {document.description}
                                  </p>
                                )}

                                <div className="d-flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={saving}
                                    onClick={() => downloadDocument(document)}
                                  >
                                    Download/View
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={saving}
                                    onClick={() => togglePublished(document)}
                                  >
                                    {document.is_published
                                      ? "Unpublish"
                                      : "Publish"}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => startEdit(document)}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    disabled={saving}
                                    onClick={() => deleteDocument(document.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
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
