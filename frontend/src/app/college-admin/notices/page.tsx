"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Audience = "everyone" | "students" | "teachers" | "parents" | "class" | "section";

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Option {
  id: number;
  name: string;
  classroom_id?: number;
}

interface Notice {
  id: number;
  title: string;
  message: string;
  audience: Audience;
  classroom: number | null;
  classroom_name?: string | null;
  section: number | null;
  section_name?: string | null;
  publish_at: string;
  expires_at?: string | null;
  attachment_url?: string | null;
  is_active: boolean;
  created_by_name?: string;
}

interface NoticeForm {
  title: string;
  message: string;
  audience: Audience;
  classroom: string;
  section: string;
  publish_at: string;
  expires_at: string;
  is_active: boolean;
  attachment: File | null;
}

const emptyForm = (): NoticeForm => ({
  title: "",
  message: "",
  audience: "everyone",
  classroom: "",
  section: "",
  publish_at: new Date().toISOString().slice(0, 16),
  expires_at: "",
  is_active: true,
  attachment: null,
});

function getSavedAdmin(): AdminUser {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function audienceLabel(value: Audience) {
  const labels: Record<Audience, string> = {
    everyone: "Everyone",
    students: "All Students",
    teachers: "All Teachers",
    parents: "All Parents",
    class: "Specific Class",
    section: "Specific Section",
  };
  return labels[value];
}

function noticeStatus(notice: Notice) {
  const now = new Date();
  const publishAt = new Date(notice.publish_at);
  const expiresAt = notice.expires_at ? new Date(notice.expires_at) : null;

  if (!notice.is_active) return { label: "Inactive", className: "bg-secondary" };
  if (publishAt > now) return { label: "Scheduled", className: "bg-info text-dark" };
  if (expiresAt && expiresAt <= now) return { label: "Expired", className: "bg-dark" };
  return { label: "Active", className: "bg-success" };
}

export default function CollegeAdminNoticesPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<Option[]>([]);
  const [form, setForm] = useState<NoticeForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const token = () => localStorage.getItem("college_admin_access_token");

  const handleAuthFailure = useCallback(() => {
    clearSession();
    router.replace("/college-admin/login");
  }, [clearSession, router]);

  const loadData = useCallback(async () => {
    const accessToken = token();
    if (!accessToken) {
      handleAuthFailure();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [noticesResponse, filtersResponse] = await Promise.all([
        fetch(`${API_BASE}/api/notices/college-admin/`, { headers }),
        fetch(`${API_BASE}/api/notices/college-admin/filters/`, { headers }),
      ]);

      if (noticesResponse.status === 401 || filtersResponse.status === 401) {
        handleAuthFailure();
        return;
      }

      const noticesJson = await noticesResponse.json();
      const filtersJson = await filtersResponse.json();

      if (!noticesResponse.ok) {
        throw new Error(noticesJson?.detail || "Unable to load notices.");
      }
      if (!filtersResponse.ok) {
        throw new Error(filtersJson?.detail || "Unable to load notice filters.");
      }

      setNotices(noticesJson);
      setClasses(filtersJson.classes || []);
      setSections(filtersJson.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notices.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableSections = useMemo(() => {
    if (!form.classroom) return sections;
    return sections.filter(
      (section) => String(section.classroom_id) === form.classroom
    );
  }, [form.classroom, sections]);

  const visibleNotices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notices.filter((notice) => {
      const matchesSearch =
        !query ||
        notice.title.toLowerCase().includes(query) ||
        notice.message.toLowerCase().includes(query);
      const matchesAudience =
        !audienceFilter || notice.audience === audienceFilter;
      return matchesSearch && matchesAudience;
    });
  }, [notices, search, audienceFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const accessToken = token();
    if (!accessToken) {
      handleAuthFailure();
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("message", form.message.trim());
      payload.append("audience", form.audience);
      payload.append("publish_at", new Date(form.publish_at).toISOString());
      payload.append("is_active", String(form.is_active));

      if (form.expires_at) {
        payload.append("expires_at", new Date(form.expires_at).toISOString());
      }

      if (form.audience === "class" && form.classroom) {
        payload.append("classroom", form.classroom);
      }

      if (form.audience === "section" && form.section) {
        payload.append("section", form.section);
      }

      if (form.attachment) {
        payload.append("attachment", form.attachment);
      }

      const url = editingId
        ? `${API_BASE}/api/notices/college-admin/${editingId}/`
        : `${API_BASE}/api/notices/college-admin/`;

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: payload,
      });

      if (response.status === 401) {
        handleAuthFailure();
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        const message =
          result?.detail ||
          Object.entries(result)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
            .join(" | ") ||
          "Unable to save notice.";
        throw new Error(message);
      }

      setSuccess(editingId ? "Notice updated successfully." : "Notice created successfully.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save notice.");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      message: notice.message,
      audience: notice.audience,
      classroom: notice.classroom ? String(notice.classroom) : "",
      section: notice.section ? String(notice.section) : "",
      publish_at: new Date(notice.publish_at).toISOString().slice(0, 16),
      expires_at: notice.expires_at
        ? new Date(notice.expires_at).toISOString().slice(0, 16)
        : "",
      is_active: notice.is_active,
      attachment: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeNotice = async (notice: Notice) => {
    if (!window.confirm(`Delete notice "${notice.title}"?`)) return;

    const accessToken = token();
    if (!accessToken) {
      handleAuthFailure();
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_BASE}/api/notices/college-admin/${notice.id}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.status === 401) {
        handleAuthFailure();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to delete notice.");
      }

      setSuccess("Notice deleted successfully.");
      if (editingId === notice.id) resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete notice.");
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
              <h2 className="fw-bold mb-1">Notices & Announcements</h2>
              <p className="text-muted mb-0">
                Publish institution-wide or targeted announcements for your college.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">
                      {editingId ? "Edit Notice" : "Create Notice"}
                    </h5>
                    <p className="text-muted small mb-0">
                      Choose an audience and publishing window for the announcement.
                    </p>
                  </div>
                  {editingId && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={resetForm}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={submit}>
                  <div className="row g-3">
                    <div className="col-12 col-lg-6">
                      <label className="form-label">Title</label>
                      <input
                        className="form-control"
                        required
                        maxLength={200}
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-lg-6">
                      <label className="form-label">Audience</label>
                      <select
                        className="form-select"
                        value={form.audience}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            audience: e.target.value as Audience,
                            classroom: "",
                            section: "",
                          })
                        }
                      >
                        <option value="everyone">Everyone</option>
                        <option value="students">All Students</option>
                        <option value="teachers">All Teachers</option>
                        <option value="parents">All Parents</option>
                        <option value="class">Specific Class</option>
                        <option value="section">Specific Section</option>
                      </select>
                    </div>

                    {form.audience === "class" && (
                      <div className="col-12 col-lg-6">
                        <label className="form-label">Class</label>
                        <select
                          className="form-select"
                          required
                          value={form.classroom}
                          onChange={(e) =>
                            setForm({ ...form, classroom: e.target.value })
                          }
                        >
                          <option value="">Select class</option>
                          {classes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {form.audience === "section" && (
                      <>
                        <div className="col-12 col-lg-6">
                          <label className="form-label">Class</label>
                          <select
                            className="form-select"
                            value={form.classroom}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                classroom: e.target.value,
                                section: "",
                              })
                            }
                          >
                            <option value="">All classes</option>
                            {classes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-lg-6">
                          <label className="form-label">Section</label>
                          <select
                            className="form-select"
                            required
                            value={form.section}
                            onChange={(e) =>
                              setForm({ ...form, section: e.target.value })
                            }
                          >
                            <option value="">Select section</option>
                            {availableSections.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="col-12">
                      <label className="form-label">Message</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        required
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Publish Date & Time</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={form.publish_at}
                        onChange={(e) =>
                          setForm({ ...form, publish_at: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Expiry Date & Time</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.expires_at}
                        onChange={(e) =>
                          setForm({ ...form, expires_at: e.target.value })
                        }
                      />
                      <div className="form-text">Optional — leave blank for no expiry.</div>
                    </div>

                    <div className="col-12 col-lg-8">
                      <label className="form-label">Attachment</label>

                      <div className="border rounded-3 bg-white p-2 d-flex align-items-center gap-3 flex-wrap">
                        <input
                          id="notice-attachment"
                          type="file"
                          className="visually-hidden"
                          onChange={(e) =>
                            setForm({
                              ...form,
                              attachment: e.target.files?.[0] || null,
                            })
                          }
                        />

                        <label
                          htmlFor="notice-attachment"
                          className="btn btn-outline-primary mb-0"
                          style={{ minWidth: 132 }}
                        >
                          Choose File
                        </label>

                        <div className="flex-grow-1 text-muted text-truncate">
                          {form.attachment
                            ? form.attachment.name
                            : editingId
                            ? "Choose a new file to replace the current attachment"
                            : "No file selected"}
                        </div>

                        {form.attachment && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() =>
                              setForm({
                                ...form,
                                attachment: null,
                              })
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="form-text">
                        Optional attachment for this notice.
                      </div>
                    </div>

                    <div className="col-12 col-lg-4 d-flex align-items-end">
                      <div className="form-check mb-2">
                        <input
                          id="notice-active"
                          className="form-check-input"
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) =>
                            setForm({ ...form, is_active: e.target.checked })
                          }
                        />
                        <label
                          htmlFor="notice-active"
                          className="form-check-label"
                        >
                          Active
                        </label>
                      </div>
                    </div>

                    <div className="col-12 d-flex justify-content-end gap-2">
                      {editingId && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={resetForm}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving..."
                          : editingId
                          ? "Update Notice"
                          : "Publish Notice"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <div className="row g-2">
                  <div className="col-12 col-md-8">
                    <input
                      className="form-control"
                      placeholder="Search notices..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <select
                      className="form-select"
                      value={audienceFilter}
                      onChange={(e) => setAudienceFilter(e.target.value)}
                    >
                      <option value="">All audiences</option>
                      <option value="everyone">Everyone</option>
                      <option value="students">Students</option>
                      <option value="teachers">Teachers</option>
                      <option value="parents">Parents</option>
                      <option value="class">Specific Class</option>
                      <option value="section">Specific Section</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body border-bottom">
                <h5 className="fw-bold mb-0">Published Notices</h5>
              </div>

              {loading ? (
                <div className="p-5 text-center text-muted">Loading notices...</div>
              ) : visibleNotices.length === 0 ? (
                <div className="p-5 text-center">
                  <h5 className="fw-bold">No Notices Found</h5>
                  <p className="text-muted mb-0">
                    Create your first announcement using the form above.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Notice</th>
                        <th>Audience</th>
                        <th>Target</th>
                        <th>Publish</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th>Attachment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleNotices.map((notice) => {
                        const status = noticeStatus(notice);
                        const target =
                          notice.audience === "class"
                            ? notice.classroom_name || "-"
                            : notice.audience === "section"
                            ? notice.section_name || "-"
                            : "-";

                        return (
                          <tr key={notice.id}>
                            <td style={{ minWidth: 260 }}>
                              <div className="fw-semibold">{notice.title}</div>
                              <small className="text-muted d-block text-truncate" style={{ maxWidth: 360 }}>
                                {notice.message}
                              </small>
                            </td>
                            <td>{audienceLabel(notice.audience)}</td>
                            <td>{target}</td>
                            <td>{new Date(notice.publish_at).toLocaleString()}</td>
                            <td>
                              {notice.expires_at
                                ? new Date(notice.expires_at).toLocaleString()
                                : "No expiry"}
                            </td>
                            <td>
                              <span className={`badge ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>
                              {notice.attachment_url ? (
                                <a
                                  href={notice.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline-secondary btn-sm"
                                >
                                  View
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => beginEdit(notice)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => void removeNotice(notice)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
