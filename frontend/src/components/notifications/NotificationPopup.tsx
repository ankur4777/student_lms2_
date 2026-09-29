"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const POLL_INTERVAL_MS = 30000;
const AUTO_DISMISS_MS = 6000;

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  related_url?: string | null;
}

interface NotificationPopupProps {
  role: "student" | "teacher" | "parent" | "college_admin";
  tokenKey: string;
  userStorageKey: string;
  loginPath: string;
}

function getStoredUserKey(role: string, userStorageKey: string) {
  if (typeof window === "undefined") {
    return role;
  }

  const savedUser = localStorage.getItem(userStorageKey);

  if (!savedUser) {
    return role;
  }

  try {
    const user = JSON.parse(savedUser);
    return String(user.id || user.username || role);
  } catch {
    return role;
  }
}

function shownStorageKey(role: string, userStorageKey: string) {
  return `lms_shown_notifications_${role}_${getStoredUserKey(
    role,
    userStorageKey
  )}`;
}

function loadShownIds(key: string) {
  if (typeof window === "undefined") {
    return new Set<number>();
  }

  try {
    return new Set<number>(
      JSON.parse(sessionStorage.getItem(key) || "[]")
    );
  } catch {
    return new Set<number>();
  }
}

function saveShownIds(key: string, ids: Set<number>) {
  sessionStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

function timeLabel(value: string) {
  const created = new Date(value).getTime();
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - created) / 1000)
  );

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  return new Date(value).toLocaleDateString();
}

export default function NotificationPopup({
  role,
  tokenKey,
  userStorageKey,
  loginPath,
}: NotificationPopupProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const stoppedRef = useRef(false);
  const shownKeyRef = useRef("");

  const closeItem = useCallback((notificationId: number) => {
    setItems((current) =>
      current.filter((item) => item.id !== notificationId)
    );
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);

    if (!token || stoppedRef.current) {
      return;
    }

    const response = await fetch(`${API_BASE}/api/notifications/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      stoppedRef.current = true;
      router.replace(loginPath);
      return;
    }

    if (!response.ok) {
      return;
    }

    const result = await response.json();
    const notifications = (result.notifications || []) as NotificationItem[];
    const key = shownKeyRef.current || shownStorageKey(role, userStorageKey);
    shownKeyRef.current = key;
    const shownIds = loadShownIds(key);
    const unreadUnseen = notifications
      .filter((item) => !item.is_read && !shownIds.has(item.id))
      .slice(0, 5);

    if (unreadUnseen.length === 0) {
      return;
    }

    unreadUnseen.forEach((item) => shownIds.add(item.id));
    saveShownIds(key, shownIds);

    setItems((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      return [
        ...unreadUnseen.filter((item) => !existingIds.has(item.id)),
        ...current,
      ].slice(0, 5);
    });
  }, [loginPath, role, router, tokenKey, userStorageKey]);

  useEffect(() => {
    stoppedRef.current = false;
    shownKeyRef.current = shownStorageKey(role, userStorageKey);

    void fetchNotifications();

    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      stoppedRef.current = true;
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications, role, userStorageKey]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const timeoutIds = items.map((item) =>
      window.setTimeout(() => {
        closeItem(item.id);
      }, AUTO_DISMISS_MS)
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [closeItem, items]);

  const viewNotification = async (item: NotificationItem) => {
    const token = localStorage.getItem(tokenKey);

    if (!token || !item.related_url) {
      return;
    }

    await fetch(`${API_BASE}/api/notifications/${item.id}/read/`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    closeItem(item.id);
    router.push(item.related_url);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="d-flex flex-column gap-2"
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "min(380px, calc(100vw - 32px))",
        zIndex: 1080,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="card border-0 shadow-lg"
          style={{
            borderRadius: "12px",
            animation: "notificationSlideIn 180ms ease-out",
          }}
        >
          <div className="card-body p-3">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
              <div className="fw-semibold">
                New Notification
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Close notification"
                onClick={() => closeItem(item.id)}
              />
            </div>

            <div className="fw-bold mb-1">{item.title}</div>
            <div className="text-muted small mb-3">{item.message}</div>

            <div className="d-flex align-items-center justify-content-between gap-2">
              <span className="text-muted small">
                {timeLabel(item.created_at)}
              </span>

              {item.related_url && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  onClick={() => void viewNotification(item)}
                >
                  View
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes notificationSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 576px) {
          div[aria-live="polite"] {
            top: 12px !important;
            right: 12px !important;
            left: 12px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
