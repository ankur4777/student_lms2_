"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

interface RelationshipOption {
  value: string;
  label: string;
}

interface ParentLinkInfo {
  id: number;
  parent_profile_id: number;
  name: string;
  username: string;
  email: string;
}

interface StudentLinkInfo {
  student_id: number;
  student_profile_id: number;
  name: string;
  username: string;
  admission_number: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
}

interface ParentStudentLink {
  link_id: number;
  relationship: string;
  parent: ParentLinkInfo;
  student: StudentLinkInfo;
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

function formatRelationship(value: string) {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CollegeAdminParentStudentLinksPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOption[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingLinkId, setSavingLinkId] = useState<number | null>(null);

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
      throw new Error(result?.detail || "Unable to manage links.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadLinks = useCallback(async (query = search) => {
    const url = new URL(
      `${API_BASE}/api/accounts/college-admin/parent-student-links/`
    );
    if (query.trim()) {
      url.searchParams.set("search", query.trim());
    }
    const result = await fetchJson(url.toString());
    setLinks(result.links || []);
  }, [fetchJson, search]);

  const loadSetup = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/accounts/college-admin/parent-student-links/setup/`
    );
    setRelationships(result.relationships || []);
  }, [fetchJson]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await Promise.all([
          loadLinks(""),
          loadSetup(),
        ]);
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
  }, [loadLinks, loadSetup]);

  const handleSearch = async () => {
    try {
      setError("");
      setMessage("");
      setLoading(true);
      await loadLinks(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateRelationship = async (
    link: ParentStudentLink,
    relationship: string
  ) => {
    try {
      setError("");
      setMessage("");
      setSavingLinkId(link.link_id);
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parent-student-links/${link.link_id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ relationship }),
        }
      );
      setMessage("Relationship updated successfully.");
      await loadLinks(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSavingLinkId(null);
    }
  };

  const unlink = async (link: ParentStudentLink) => {
    const confirmed = window.confirm(
      `Unlink ${link.student.name} from ${link.parent.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setSavingLinkId(link.link_id);
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parent-student-links/${link.link_id}/`,
        { method: "DELETE" }
      );
      setMessage("Parent-student link removed successfully.");
      await loadLinks(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSavingLinkId(null);
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
                <h2 className="fw-bold mb-1">
                  Parent-Student Links
                </h2>
                <p className="text-muted mb-0">
                  Manage parent access to linked students.
                </p>
              </div>
              <Link
                className="btn btn-primary"
                href="/college-admin/parent-student-links/create"
              >
                Create Link
              </Link>
            </div>

            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-10">
                    <input
                      className="form-control"
                      placeholder="Search by parent, student, username, email, or admission number"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-md-2 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleSearch}
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading links...
                </div>
              </div>
            ) : links.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Links</h5>
                  <p className="text-muted mb-0">
                    Parent-student links created for this college will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Parent</th>
                        <th>Parent Username / Email</th>
                        <th>Student</th>
                        <th>Student Username / Roll Number</th>
                        <th>Relationship</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map((link) => (
                        <tr key={link.link_id}>
                          <td>
                            <div className="fw-semibold">
                              {link.parent.name}
                            </div>
                          </td>
                          <td>
                            <div>{link.parent.username}</div>
                            <div className="text-muted small">
                              {link.parent.email || "-"}
                            </div>
                          </td>
                          <td>
                            <div className="fw-semibold">
                              {link.student.name}
                            </div>
                            <div className="text-muted small">
                              {link.student.admission_number || "-"}
                            </div>
                          </td>
                          <td>
                            <div>{link.student.username}</div>
                            <div className="text-muted small">
                              {link.student.roll_number || "-"}
                            </div>
                          </td>
                          <td style={{ minWidth: "160px" }}>
                            <select
                              className="form-select form-select-sm"
                              value={link.relationship}
                              disabled={savingLinkId === link.link_id}
                              onChange={(event) =>
                                updateRelationship(
                                  link,
                                  event.target.value
                                )
                              }
                            >
                              {relationships.length === 0 ? (
                                <option value={link.relationship}>
                                  {formatRelationship(link.relationship)}
                                </option>
                              ) : relationships.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={savingLinkId === link.link_id}
                              onClick={() => unlink(link)}
                            >
                              Unlink
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
