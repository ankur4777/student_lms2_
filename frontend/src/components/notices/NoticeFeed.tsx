"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface NoticeItem {
  id: number;
  title: string;
  message: string;
  audience: string;
  classroom_name?: string | null;
  section_name?: string | null;
  publish_at: string;
  expires_at?: string | null;
  attachment_url?: string | null;
}

interface NoticeFeedProps {
  tokenKey: string;
  loginPath: string;
  title?: string;
}

function audienceLabel(value: string) {
  const labels: Record<string, string> = {
    everyone: "Everyone",
    students: "Students",
    teachers: "Teachers",
    parents: "Parents",
    class: "Class",
    section: "Section",
  };
  return labels[value] || value;
}

export default function NoticeFeed({
  tokenKey,
  loginPath,
  title = "Notices & Announcements",
}: NoticeFeedProps) {
  const router = useRouter();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNotices() {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        router.replace(loginPath);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/notices/feed/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem(tokenKey);
          router.replace(loginPath);
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load notices.");
        }

        if (active) {
          setNotices(result || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load notices."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNotices();

    return () => {
      active = false;
    };
  }, [loginPath, router, tokenKey]);

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
          <div>
            <h5 className="fw-bold mb-1">{title}</h5>
            <p className="text-muted small mb-0">
              Current announcements relevant to you.
            </p>
          </div>

          {notices.length > 0 && (
            <span className="badge bg-primary">
              {notices.length} active
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-muted">Loading notices...</div>
        ) : error ? (
          <div className="alert alert-warning mb-0">{error}</div>
        ) : notices.length === 0 ? (
          <div className="text-muted">
            No active notices at the moment.
          </div>
        ) : (
          <div className="row g-3">
            {notices.map((notice) => {
              const target =
                notice.audience === "class"
                  ? notice.classroom_name
                  : notice.audience === "section"
                  ? notice.section_name
                  : null;

              return (
                <div className="col-12 col-lg-6" key={notice.id}>
                  <div className="border rounded-3 p-3 h-100 bg-light">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <h6 className="fw-bold mb-0">{notice.title}</h6>
                      <span className="badge bg-secondary">
                        {audienceLabel(notice.audience)}
                      </span>
                    </div>

                    {target && (
                      <div className="small text-muted mb-2">
                        Target: {target}
                      </div>
                    )}

                    <p className="mb-2">{notice.message}</p>

                    <div className="small text-muted">
                      Published: {new Date(notice.publish_at).toLocaleString()}
                    </div>

                    {notice.expires_at && (
                      <div className="small text-muted">
                        Expires: {new Date(notice.expires_at).toLocaleString()}
                      </div>
                    )}

                    {notice.attachment_url && (
                      <a
                        className="btn btn-outline-primary btn-sm mt-3"
                        href={notice.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View Attachment
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
