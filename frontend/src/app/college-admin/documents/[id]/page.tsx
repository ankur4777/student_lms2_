"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface DocumentItem {
  id: number;
  title: string;
  description: string;
  document_type: string;
  filename: string;
  teacher_name: string;
  subject_name: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
  status: string;
  created_at: string;
  updated_at: string;
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

function statusClass(statusValue: string) {
  return statusValue === "published"
    ? "badge bg-success"
    : "badge bg-secondary";
}

export default function CollegeAdminDocumentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
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
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || "Unable to load document.");
    }
    return result;
  }, [clearSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await fetchJson(
          `${API_BASE}/api/documents/college-admin/${params.id}/`
        );
        if (isMounted) {
          setDocument(result.document);
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
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchJson, params.id]);

  const downloadDocument = async () => {
    const token = getToken();
    if (!token || !document) {
      return;
    }

    setDownloading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/documents/college-admin/${document.id}/download/`,
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

      if (!response.ok) {
        throw new Error("Unable to download document.");
      }

      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = document.filename || document.title;
      anchor.click();
      URL.revokeObjectURL(fileUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to download document."
      );
    } finally {
      setDownloading(false);
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
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">Document Detail</h2>
                <p className="text-muted mb-0">
                  Read-only document monitoring.
                </p>
              </div>
              <Link
                className="btn btn-outline-secondary"
                href="/college-admin/documents"
              >
                Back
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading document...
                </div>
              </div>
            ) : document ? (
              <div className="row g-3">
                <div className="col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="fw-bold">Document Information</h5>
                      <div className="fw-semibold">{document.title}</div>
                      <div className="text-muted mt-2">
                        {document.description || "-"}
                      </div>
                      <div className="mt-3">
                        Type: {document.document_type}
                      </div>
                      <div>File: {document.filename || "-"}</div>
                      <div>Uploaded: {document.created_at}</div>
                      <span className={statusClass(document.status)}>
                        {document.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="fw-bold">Academic Information</h5>
                      <div>Subject: {document.subject_name}</div>
                      <div>
                        Class / Section: {document.classroom_name} /{" "}
                        {document.section_name}
                      </div>
                      <div>
                        Session: {document.academic_session_name || "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="fw-bold">Teacher Information</h5>
                      <div>{document.teacher_name}</div>

                      <button
                        type="button"
                        className="btn btn-primary mt-4"
                        disabled={downloading}
                        onClick={downloadDocument}
                      >
                        {downloading ? "Downloading..." : "View / Download File"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Document not found.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
