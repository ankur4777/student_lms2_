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

interface FilterOption {
  id: number;
  name: string;
}

interface SetupData {
  teachers: FilterOption[];
  subjects: FilterOption[];
  classes: FilterOption[];
  sections: FilterOption[];
}

interface Assignment {
  id: number;
  title: string;
  teacher_name: string;
  subject_name: string;
  classroom_name: string;
  section_name: string;
  due_date: string;
  due_time: string | null;
  status: string;
  total_eligible_students: number;
  submission_count: number;
  graded_count: number;
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

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "-";
}

function statusClass(statusValue: string) {
  return statusValue === "published"
    ? "badge bg-success"
    : "badge bg-secondary";
}

export default function CollegeAdminAssignmentsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [setup, setSetup] = useState<SetupData>({
    teachers: [],
    subjects: [],
    classes: [],
    sections: [],
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacher, setTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [classroom, setClassroom] = useState("");
  const [section, setSection] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      throw new Error(result.detail || "Unable to load assignments.");
    }
    return result;
  }, [clearSession, router]);

  const buildUrl = useCallback(() => {
    const url = new URL(`${API_BASE}/api/assignments/college-admin/`);
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
    if (statusFilter) {
      url.searchParams.set("status", statusFilter);
    }
    if (search.trim()) {
      url.searchParams.set("search", search.trim());
    }
    return url.toString();
  }, [classroom, search, section, statusFilter, subject, teacher]);

  const loadAssignments = useCallback(async () => {
    const result = await fetchJson(buildUrl());
    setAssignments(result.assignments || []);
  }, [buildUrl, fetchJson]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const setupResult = await fetchJson(
          `${API_BASE}/api/assignments/college-admin/setup/`
        );
        if (isMounted) {
          setSetup(setupResult);
        }
        await loadAssignments();
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
  }, [fetchJson, loadAssignments]);

  const applyFilters = async () => {
    setLoading(true);
    setError("");
    try {
      await loadAssignments();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitted = assignments.reduce(
    (total, item) => total + item.submission_count,
    0
  );
  const eligible = assignments.reduce(
    (total, item) => total + item.total_eligible_students,
    0
  );

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
              <h2 className="fw-bold mb-1">Assignments</h2>
              <p className="text-muted mb-0">
                Monitor assignment activity across your institution.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3 mb-4">
              {[
                ["Assignments", assignments.length],
                ["Eligible Students", eligible],
                ["Submissions", submitted],
                [
                  "Submission Progress",
                  eligible ? `${Math.round((submitted / eligible) * 100)}%` : "0%",
                ],
              ].map(([label, value]) => (
                <div key={label} className="col-xl-3 col-md-6">
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
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={teacher}
                      onChange={(event) => setTeacher(event.target.value)}
                    >
                      <option value="">All teachers</option>
                      {setup.teachers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      <option value="">All subjects</option>
                      {setup.subjects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={classroom}
                      onChange={(event) => setClassroom(event.target.value)}
                    >
                      <option value="">All classes</option>
                      {setup.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={section}
                      onChange={(event) => setSection(event.target.value)}
                    >
                      <option value="">All sections</option>
                      {setup.sections.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <div className="col-lg-2 col-md-4">
                    <input
                      className="form-control"
                      placeholder="Search title"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-12">
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
                  Loading assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div className="card-body py-5 text-center text-muted">
                  No assignments found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Assignment</th>
                        <th>Teacher</th>
                        <th>Subject</th>
                        <th>Class / Section</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td className="fw-semibold">{assignment.title}</td>
                          <td>{assignment.teacher_name}</td>
                          <td>{assignment.subject_name}</td>
                          <td>
                            {assignment.classroom_name} /{" "}
                            {assignment.section_name}
                          </td>
                          <td>
                            {assignment.due_date}
                            <div className="small text-muted">
                              {formatTime(assignment.due_time)}
                            </div>
                          </td>
                          <td>
                            <span className={statusClass(assignment.status)}>
                              {assignment.status}
                            </span>
                          </td>
                          <td>
                            {assignment.submission_count} /{" "}
                            {assignment.total_eligible_students}
                            <div className="small text-muted">
                              {assignment.graded_count} graded
                            </div>
                          </td>
                          <td>
                            <Link
                              className="btn btn-outline-primary btn-sm"
                              href={`/college-admin/assignments/${assignment.id}`}
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
