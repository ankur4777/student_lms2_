"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface DocumentItem {
  id: number;
  title: string;
  document_type: string;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
  class_id: number;
  classroom_name: string;
  section_id: number;
  section_name: string;
  academic_session_id: number;
  academic_session_name: string;
  status: string;
  created_at: string;
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

function uniqueOptions(
  documents: DocumentItem[],
  idKey: keyof DocumentItem,
  nameKey: keyof DocumentItem
) {
  const items = new Map<number, string>();
  documents.forEach((document) => {
    const id = Number(document[idKey]);
    const name = String(document[nameKey] || "");
    if (id && name) {
      items.set(id, name);
    }
  });
  return Array.from(items, ([id, name]) => ({ id, name }));
}

function statusClass(statusValue: string) {
  return statusValue === "published"
    ? "badge bg-success"
    : "badge bg-secondary";
}

export default function CollegeAdminDocumentsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [teacher, setTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [classroom, setClassroom] = useState("");
  const [section, setSection] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const teachers = useMemo(
    () => uniqueOptions(documents, "teacher_id", "teacher_name"),
    [documents]
  );
  const subjects = useMemo(
    () => uniqueOptions(documents, "subject_id", "subject_name"),
    [documents]
  );
  const classes = useMemo(
    () => uniqueOptions(documents, "class_id", "classroom_name"),
    [documents]
  );
  const sections = useMemo(
    () => uniqueOptions(documents, "section_id", "section_name"),
    [documents]
  );
  const sessions = useMemo(
    () =>
      uniqueOptions(
        documents,
        "academic_session_id",
        "academic_session_name"
      ),
    [documents]
  );

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
      throw new Error(result.detail || "Unable to load documents.");
    }
    return result;
  }, [clearSession, router]);

  const buildUrl = useCallback(() => {
    const url = new URL(`${API_BASE}/api/documents/college-admin/`);
    if (teacher) {
      url.searchParams.set("teacher", teacher);
    }
    if (subject) {
      url.searchParams.set("subject", subject);
    }
    if (classroom) {
      url.searchParams.set("class", classroom);
    }
    if (section) {
      url.searchParams.set("section", section);
    }
    if (academicSession) {
      url.searchParams.set("academic_session", academicSession);
    }
    if (statusFilter) {
      url.searchParams.set("status", statusFilter);
    }
    if (search.trim()) {
      url.searchParams.set("search", search.trim());
    }
    return url.toString();
  }, [
    academicSession,
    classroom,
    search,
    section,
    statusFilter,
    subject,
    teacher,
  ]);

  const loadDocuments = useCallback(async () => {
    const result = await fetchJson(buildUrl());
    setDocuments(result.documents || []);
  }, [buildUrl, fetchJson]);

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

  const applyFilters = async () => {
    setLoading(true);
    setError("");
    try {
      await loadDocuments();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Documents</h2>
              <p className="text-muted mb-0">
                Monitor teacher-uploaded class documents.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3 mb-4">
              {[
                ["Documents", documents.length],
                [
                  "Published",
                  documents.filter((item) => item.status === "published")
                    .length,
                ],
                [
                  "Draft",
                  documents.filter((item) => item.status === "draft").length,
                ],
              ].map(([label, value]) => (
                <div key={label} className="col-xl-4 col-md-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="text-muted small">{label}</div>
                      <div className="fs-4 fw-bold">{value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  {[
                    ["All teachers", teacher, setTeacher, teachers],
                    ["All subjects", subject, setSubject, subjects],
                    ["All classes", classroom, setClassroom, classes],
                    ["All sections", section, setSection, sections],
                    [
                      "All sessions",
                      academicSession,
                      setAcademicSession,
                      sessions,
                    ],
                  ].map(([label, value, setter, options]) => (
                    <div key={label as string} className="col-lg-2 col-md-4">
                      <select
                        className="form-select"
                        value={value as string}
                        onChange={(event) =>
                          (setter as (nextValue: string) => void)(
                            event.target.value
                          )
                        }
                      >
                        <option value="">{label as string}</option>
                        {(options as { id: number; name: string }[]).map(
                          (item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  ))}
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  <div className="col-lg-10 col-md-8">
                    <input
                      className="form-control"
                      placeholder="Search title"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-lg-2 col-md-4 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={applyFilters}
                    >
                      Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              {loading ? (
                <div className="card-body py-5 text-center text-muted">
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="card-body py-5 text-center text-muted">
                  No documents found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Teacher</th>
                        <th>Subject</th>
                        <th>Class / Section</th>
                        <th>Academic Session</th>
                        <th>Status</th>
                        <th>Uploaded Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <div className="fw-semibold">
                              {document.title}
                            </div>
                            <div className="small text-muted">
                              {document.document_type}
                            </div>
                          </td>
                          <td>{document.teacher_name}</td>
                          <td>{document.subject_name}</td>
                          <td>
                            {document.classroom_name} /{" "}
                            {document.section_name}
                          </td>
                          <td>{document.academic_session_name}</td>
                          <td>
                            <span className={statusClass(document.status)}>
                              {document.status}
                            </span>
                          </td>
                          <td>{document.created_at}</td>
                          <td>
                            <Link
                              className="btn btn-outline-primary btn-sm"
                              href={`/college-admin/documents/${document.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
