"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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

interface ParentProfile {
  phone: string;
  occupation: string;
}

interface LinkedStudent {
  link_id: number;
  student_id: number;
  student_profile_id: number;
  name: string;
  username: string;
  admission_number: string;
  roll_number: string;
  relationship: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
}

interface Parent {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  date_joined: string;
  profile: ParentProfile | null;
  linked_students: LinkedStudent[];
}

interface StudentOption {
  student_profile_id: number;
  student_id: number;
  name: string;
  username: string;
  admission_number: string;
}

interface RelationshipOption {
  value: string;
  label: string;
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
  if (!value) {
    return "-";
  }
  return value;
}

function formatRelationship(value: string) {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CollegeAdminParentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [parent, setParent] = useState<Parent | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOption[]>(
    []
  );
  const [studentProfileId, setStudentProfileId] = useState("");
  const [relationship, setRelationship] = useState("guardian");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");

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
      throw new Error(result?.detail || "Unable to load parent.");
    }
    return result;
  }, [clearSession, getToken, router]);

  const loadParent = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/accounts/college-admin/parents/${params.id}/`
    );
    setParent(result.parent || null);
  }, [fetchJson, params.id]);

  const loadOptions = useCallback(async () => {
    const result = await fetchJson(
      `${API_BASE}/api/accounts/college-admin/parents/${params.id}/link-options/`
    );
    setStudents(result.students || []);
    setRelationships(result.relationships || []);
  }, [fetchJson, params.id]);

  const loadPage = useCallback(async () => {
    await Promise.all([
      loadParent(),
      loadOptions(),
    ]);
  }, [loadOptions, loadParent]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await loadPage();
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
  }, [loadPage]);

  const handleLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentProfileId) {
      setLinkError("Select a student to link.");
      return;
    }

    try {
      setSaving(true);
      setLinkError("");
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parents/${params.id}/student-links/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_profile_id: studentProfileId,
            relationship,
          }),
        }
      );
      setStudentProfileId("");
      await loadPage();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setLinkError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const unlinkStudent = async (linkId: number) => {
    const confirmed = window.confirm(
      "Unlink this student from the parent?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setLinkError("");
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parents/${params.id}/student-links/${linkId}/`,
        {
          method: "DELETE",
        }
      );
      await loadPage();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setLinkError(err.message);
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
                <h2 className="fw-bold mb-1">Parent Details</h2>
                <p className="text-muted mb-0">
                  View parent account, profile, and linked students.
                </p>
              </div>

              {parent && (
                <Link
                  className="btn btn-primary"
                  href={`/college-admin/parents/${parent.id}/edit`}
                >
                  Edit
                </Link>
              )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading parent...
                </div>
              </div>
            ) : parent ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Account Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Name</div>
                        <div className="fw-semibold">{parent.name}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Username</div>
                        <div className="fw-semibold">{parent.username}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Email</div>
                        <div className="fw-semibold">
                          {formatValue(parent.email)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Status</div>
                        <span
                          className={
                            parent.is_active
                              ? "badge bg-success"
                              : "badge bg-secondary"
                          }
                        >
                          {parent.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Parent Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Phone</div>
                        <div className="fw-semibold">
                          {formatValue(parent.profile?.phone)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Occupation</div>
                        <div className="fw-semibold">
                          {formatValue(parent.profile?.occupation)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                      <h5 className="fw-bold mb-0">
                        Linked Students
                      </h5>
                    </div>

                    {linkError && (
                      <div className="alert alert-danger">
                        {linkError}
                      </div>
                    )}

                    <form onSubmit={handleLink} className="mb-4">
                      <div className="row g-2">
                        <div className="col-md-6">
                          <select
                            className="form-select"
                            value={studentProfileId}
                            onChange={(event) =>
                              setStudentProfileId(event.target.value)
                            }
                          >
                            <option value="">Select student</option>
                            {students.map((student) => (
                              <option
                                key={student.student_profile_id}
                                value={student.student_profile_id}
                              >
                                {student.name} ({student.admission_number})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <select
                            className="form-select"
                            value={relationship}
                            onChange={(event) =>
                              setRelationship(event.target.value)
                            }
                          >
                            {relationships.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3 d-grid">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving || students.length === 0}
                          >
                            {saving ? "Saving..." : "Link Student"}
                          </button>
                        </div>
                      </div>
                    </form>

                    {parent.linked_students.length === 0 ? (
                      <div className="text-muted">
                        No students linked to this parent.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Roll Number</th>
                              <th>Class / Section</th>
                              <th>Academic Session</th>
                              <th>Relationship</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parent.linked_students.map((student) => (
                              <tr key={student.link_id}>
                                <td>
                                  <div className="fw-semibold">
                                    {student.name}
                                  </div>
                                  <div className="text-muted small">
                                    {student.admission_number}
                                  </div>
                                </td>
                                <td>{student.roll_number || "-"}</td>
                                <td>
                                  {student.classroom_name ? (
                                    <>
                                      {student.classroom_name} /{" "}
                                      {student.section_name || "-"}
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td>
                                  {student.academic_session_name || "-"}
                                </td>
                                <td>
                                  {formatRelationship(student.relationship)}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    disabled={saving}
                                    onClick={() =>
                                      unlinkStudent(student.link_id)
                                    }
                                  >
                                    Unlink
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
