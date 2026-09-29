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

interface LiveClass {
  id: number;
  title: string;
  description: string;
  teacher_name: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  section_name: string;
  academic_session: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  can_edit: boolean;
  can_cancel: boolean;
  recording: {
    exists: boolean;
    title: string;
    is_available: boolean;
    uploaded_at: string | null;
  };
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

function formatValue(value?: string | null) {
  return value || "-";
}

function formatTime(value: string) {
  return value ? value.slice(0, 5) : "-";
}

function statusClass(status: string) {
  if (status === "scheduled") {
    return "badge bg-primary";
  }
  if (status === "live") {
    return "badge bg-success";
  }
  if (status === "completed") {
    return "badge bg-secondary";
  }
  return "badge bg-danger";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function CollegeAdminLiveClassDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.detail || "Unable to load live class.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadClass = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/live-classes/college-admin/classes/${params.id}/`
    );
    setLiveClass(result.class || null);
  }, [fetchJson, params.id]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await loadClass();
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
  }, [loadClass]);

  const cancelClass = async () => {
    setSaving(true);
    setError("");
    try {
      await fetchJson(
        `${API_BASE}/api/live-classes/college-admin/classes/${params.id}/cancel/`,
        {
          method: "POST",
        }
      );
      await loadClass();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
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
                <h2 className="fw-bold mb-1">Live Class Details</h2>
                <p className="text-muted mb-0">
                  Review schedule, academic, meeting, and recording details.
                </p>
              </div>

              {liveClass && (
                <div className="d-flex gap-2">
                  {liveClass.can_edit && (
                    <Link
                      className="btn btn-primary"
                      href={`/college-admin/live-classes/${liveClass.id}/edit`}
                    >
                      Edit
                    </Link>
                  )}
                  {liveClass.can_cancel && (
                    <button
                      className="btn btn-outline-danger"
                      type="button"
                      disabled={saving}
                      onClick={cancelClass}
                    >
                      {saving ? "Cancelling..." : "Cancel Class"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading live class...
                </div>
              </div>
            ) : liveClass ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Live Class Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Title</div>
                        <div className="fw-semibold">{liveClass.title}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Status</div>
                        <span className={statusClass(liveClass.status)}>
                          {formatStatus(liveClass.status)}
                        </span>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Date</div>
                        <div className="fw-semibold">
                          {liveClass.class_date}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Start Time</div>
                        <div className="fw-semibold">
                          {formatTime(liveClass.start_time)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">End Time</div>
                        <div className="fw-semibold">
                          {formatTime(liveClass.end_time)}
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted small">Description</div>
                        <div className="fw-semibold">
                          {formatValue(liveClass.description)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Academic Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Teacher</div>
                        <div className="fw-semibold">
                          {liveClass.teacher_name}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Subject</div>
                        <div className="fw-semibold">
                          {liveClass.subject_name}
                          {liveClass.subject_code
                            ? ` (${liveClass.subject_code})`
                            : ""}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Class / Section</div>
                        <div className="fw-semibold">
                          {liveClass.class_name} / {liveClass.section_name}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">
                          Academic Session
                        </div>
                        <div className="fw-semibold">
                          {liveClass.academic_session}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Meeting Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-12">
                        <div className="text-muted small">Meeting Link</div>
                        <div className="fw-semibold">
                          {formatValue(liveClass.meeting_link)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Recording Information
                    </h5>
                    {liveClass.recording.exists ? (
                      <div className="row g-4">
                        <div className="col-md-4">
                          <div className="text-muted small">Title</div>
                          <div className="fw-semibold">
                            {formatValue(liveClass.recording.title)}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Status</div>
                          <span
                            className={
                              liveClass.recording.is_available
                                ? "badge bg-success"
                                : "badge bg-secondary"
                            }
                          >
                            {liveClass.recording.is_available
                              ? "Available"
                              : "Unavailable"}
                          </span>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Uploaded At</div>
                          <div className="fw-semibold">
                            {formatValue(liveClass.recording.uploaded_at)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted">
                        No recording is available for this live class.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
