"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const DOCUMENT_TYPES = [
  { value: "all", label: "All" },
  { value: "notes", label: "Notes" },
  { value: "syllabus", label: "Syllabus" },
  { value: "timetable", label: "Timetable" },
  { value: "study_material", label: "Study Material" },
  { value: "worksheet", label: "Worksheet" },
  { value: "notice", label: "Notice" },
  { value: "other", label: "Other" },
];

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface DocumentItem {
  id: number;
  title: string;
  description: string;
  document_type: string;
  subject_name: string;
  teacher_name: string;
  classroom_name: string;
  section_name: string;
  filename: string;
  created_at: string;
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

export default function StudentDocumentsPage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredDocuments = useMemo(() => {
    if (filter === "all") {
      return documents;
    }

    return documents.filter(
      (document) => document.document_type === filter
    );
  }, [documents, filter]);

  const clearStudentSession = useCallback(() => {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return "";
    }

    return token;
  }, [router]);

  const fetchJson = useCallback(async (url: string) => {
    const token = getToken();

    if (!token) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      clearStudentSession();
      router.replace("/student/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Unable to load documents."
      );
    }

    return result;
  }, [clearStudentSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      try {
        const result = await fetchJson(
          `${API_BASE}/api/documents/student/`
        );

        if (isMounted) {
          setDocuments(result.documents || []);
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

    void loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [fetchJson]);

  const downloadDocument = async (document: DocumentItem) => {
    try {
      setSaving(true);
      setError("");

      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/documents/student/${document.id}/download/`,
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
              <StudentFeatureRestricted featureName="Documents" />
            ) : (
              <>
                <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Documents
              </h2>

              <p className="text-muted mb-0">
                Access your class notes and study materials.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
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
                    <div className="d-flex flex-wrap gap-2">
                      {DOCUMENT_TYPES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={
                            filter === item.value
                              ? "btn btn-primary"
                              : "btn btn-outline-secondary"
                          }
                          onClick={() => setFilter(item.value)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredDocuments.length === 0 ? (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-5 text-center">
                      <h5 className="fw-bold">
                        No Documents
                      </h5>

                      <p className="text-muted mb-0">
                        Published class documents will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="row g-4">
                    {filteredDocuments.map((document) => (
                      <div
                        className="col-md-6"
                        key={document.id}
                      >
                        <div className="card border-0 shadow-sm h-100">
                          <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                              <div>
                                <h5 className="fw-bold mb-1">
                                  {document.title}
                                </h5>

                                <div className="text-muted">
                                  {formatType(document.document_type)}
                                </div>
                              </div>

                              <span className="badge bg-primary">
                                {document.subject_name}
                              </span>
                            </div>

                            <div className="row g-3 mb-3">
                              <div className="col-sm-6">
                                <div className="text-muted small">
                                  Teacher
                                </div>

                                <div className="fw-semibold">
                                  {document.teacher_name}
                                </div>
                              </div>

                              <div className="col-sm-6">
                                <div className="text-muted small">
                                  Class / Section
                                </div>

                                <div className="fw-semibold">
                                  {document.classroom_name}{" "}
                                  {document.section_name}
                                </div>
                              </div>

                              <div className="col-sm-6">
                                <div className="text-muted small">
                                  File
                                </div>

                                <div className="fw-semibold">
                                  {document.filename || "-"}
                                </div>
                              </div>

                              <div className="col-sm-6">
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

                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              disabled={saving}
                              onClick={() => downloadDocument(document)}
                            >
                              Download/View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
