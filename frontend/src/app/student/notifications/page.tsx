"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  related_url: string | null;
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

function formatType(type: string) {
  return type
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function isValidStudentRoute(url: string | null) {
  return Boolean(
    url &&
      url.startsWith("/student/") &&
      !url.startsWith("//")
  );
}

export default function StudentNotificationsPage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      clearStudentSession();
      router.replace("/student/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Unable to load notifications."
      );
    }

    return result;
  }, [clearStudentSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const [notificationResult, countResult] =
          await Promise.all([
            fetchJson(`${API_BASE}/api/notifications/`),
            fetchJson(
              `${API_BASE}/api/notifications/unread-count/`
            ),
          ]);

        if (isMounted) {
          setNotifications(notificationResult.notifications || []);
          setUnreadCount(countResult.unread_count || 0);
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

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [fetchJson]);

  const markAsRead = async (notificationId: number) => {
    try {
      setSaving(true);
      setError("");

      await fetchJson(
        `${API_BASE}/api/notifications/${notificationId}/read/`,
        {
          method: "PATCH",
        }
      );

      setNotifications((items) =>
        items.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true }
            : item
        )
      );
      setUnreadCount((count) => Math.max(count - 1, 0));
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setSaving(true);
      setError("");

      await fetchJson(
        `${API_BASE}/api/notifications/read-all/`,
        {
          method: "PATCH",
        }
      );

      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

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

            {isClassFeatureRestricted(error) ? (
              <StudentFeatureRestricted featureName="Notifications" />
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">
                  Notifications
                </h2>

                <p className="text-muted mb-0">
                  {unreadCount} unread notification
                  {unreadCount === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={saving || unreadCount === 0}
                onClick={markAllAsRead}
              >
                Mark All as Read
              </button>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading notifications...
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">
                    No Notifications
                  </h5>

                  <p className="text-muted mb-0">
                    New notifications will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={
                      notification.is_read
                        ? "card border-0 shadow-sm"
                        : "card border-primary shadow-sm"
                    }
                  >
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge bg-secondary">
                              {formatType(
                                notification.notification_type
                              )}
                            </span>

                            <span
                              className={
                                notification.is_read
                                  ? "badge bg-light text-dark"
                                  : "badge bg-primary"
                              }
                            >
                              {notification.is_read
                                ? "Read"
                                : "Unread"}
                            </span>
                          </div>

                          <h5 className="fw-bold mb-2">
                            {notification.title}
                          </h5>

                          <p className="text-muted mb-2">
                            {notification.message}
                          </p>

                          <div className="text-muted small">
                            {formatDate(notification.created_at)}
                          </div>
                        </div>

                        <div className="d-flex gap-2 flex-wrap">
                          {isValidStudentRoute(
                            notification.related_url
                          ) && (
                            <Link
                              className="btn btn-outline-secondary btn-sm"
                              href={notification.related_url || "#"}
                            >
                              Open
                            </Link>
                          )}

                          {!notification.is_read && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={saving}
                              onClick={() =>
                                markAsRead(notification.id)
                              }
                            >
                              Mark as Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
