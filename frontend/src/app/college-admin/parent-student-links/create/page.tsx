"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface ParentOption {
  parent_profile_id: number;
  parent_id: number;
  name: string;
  username: string;
  email: string;
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

export default function CreateParentStudentLinkPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [relationships, setRelationships] = useState<RelationshipOption[]>([]);
  const [parentProfileId, setParentProfileId] = useState("");
  const [studentProfileId, setStudentProfileId] = useState("");
  const [relationship, setRelationship] = useState("guardian");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      throw new Error(result?.detail || "Unable to save link.");
    }
    return result;
  }, [clearSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await fetchJson(
          `${API_BASE}/api/accounts/college-admin/parent-student-links/setup/`
        );
        if (isMounted) {
          setParents(result.parents || []);
          setStudents(result.students || []);
          setRelationships(result.relationships || []);
          setRelationship(result.relationships?.[0]?.value || "guardian");
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
  }, [fetchJson]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!parentProfileId || !studentProfileId) {
      setError("Select both a parent and a student.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/parent-student-links/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent_profile_id: parentProfileId,
            student_profile_id: studentProfileId,
            relationship,
          }),
        }
      );
      setMessage("Parent-student link created successfully.");
      router.replace("/college-admin/parent-student-links");
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
                <h2 className="fw-bold mb-1">
                  Create Parent-Student Link
                </h2>
                <p className="text-muted mb-0">
                  Link a parent to a student in this institution.
                </p>
              </div>
              <Link
                className="btn btn-outline-secondary"
                href="/college-admin/parent-student-links"
              >
                Back
              </Link>
            </div>

            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading options...
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-4">
                      <div className="col-md-6">
                        <label className="form-label">Parent</label>
                        <select
                          className="form-select"
                          value={parentProfileId}
                          onChange={(event) =>
                            setParentProfileId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select parent</option>
                          {parents.map((parent) => (
                            <option
                              key={parent.parent_profile_id}
                              value={parent.parent_profile_id}
                            >
                              {parent.name} ({parent.username})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Student</label>
                        <select
                          className="form-select"
                          value={studentProfileId}
                          onChange={(event) =>
                            setStudentProfileId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select student</option>
                          {students.map((student) => (
                            <option
                              key={student.student_profile_id}
                              value={student.student_profile_id}
                            >
                              {student.name} ({student.admission_number || student.username})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Relationship</label>
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
                    </div>

                    <div className="d-flex flex-wrap gap-2 mt-4">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save Link"}
                      </button>
                      <Link
                        className="btn btn-outline-secondary"
                        href="/college-admin/parent-student-links"
                      >
                        Cancel
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
