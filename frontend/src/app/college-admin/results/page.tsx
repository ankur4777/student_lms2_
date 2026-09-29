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
  academic_sessions: FilterOption[];
}

interface Exam {
  id: number;
  name: string;
  subject_names: string;
  teacher_names: string;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
  exam_date: string;
  status: string;
  eligible_students: number;
  results_entered: number;
  pending_students: number;
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

export default function CollegeAdminResultsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [setup, setSetup] = useState<SetupData>({
    teachers: [],
    subjects: [],
    classes: [],
    sections: [],
    academic_sessions: [],
  });
  const [exams, setExams] = useState<Exam[]>([]);
  const [teacher, setTeacher] = useState("");
  const [subject, setSubject] = useState("");
  const [classroom, setClassroom] = useState("");
  const [section, setSection] = useState("");
  const [academicSession, setAcademicSession] = useState("");
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
      throw new Error(result.detail || "Unable to load results.");
    }
    return result;
  }, [clearSession, router]);

  const buildUrl = useCallback(() => {
    const url = new URL(`${API_BASE}/api/results/college-admin/`);
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
    if (academicSession) {
      url.searchParams.set("academic_session", academicSession);
    }
    if (statusFilter) {
      url.searchParams.set("status", statusFilter);
    }
    if (search.trim()) {
      url.searchParams.set("search", search.trim());
    }
    return url.toString();
  }, [
    academicSession,
    classroom,
    search,
    section,
    statusFilter,
    subject,
    teacher,
  ]);

  const loadResults = useCallback(async () => {
    const result = await fetchJson(buildUrl());
    setExams(result.exams || []);
  }, [buildUrl, fetchJson]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const setupResult = await fetchJson(
          `${API_BASE}/api/results/college-admin/setup/`
        );
        if (isMounted) {
          setSetup(setupResult);
        }
        await loadResults();
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
  }, [fetchJson, loadResults]);

  const applyFilters = async () => {
    setLoading(true);
    setError("");
    try {
      await loadResults();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const eligible = exams.reduce(
    (total, item) => total + item.eligible_students,
    0
  );
  const entered = exams.reduce(
    (total, item) => total + item.results_entered,
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
              <h2 className="fw-bold mb-1">Results</h2>
              <p className="text-muted mb-0">
                Monitor published and unpublished results across your institution.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3 mb-4">
              {[
                ["Exams", exams.length],
                ["Eligible Students", eligible],
                ["Results Entered", entered],
                ["Pending", Math.max(eligible - entered, 0)],
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
                      value={academicSession}
                      onChange={(event) =>
                        setAcademicSession(event.target.value)
                      }
                    >
                      <option value="">All sessions</option>
                      {setup.academic_sessions.map((item) => (
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
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>
                  <div className="col-lg-10 col-md-8">
                    <input
                      className="form-control"
                      placeholder="Search exam"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="col-lg-2 col-md-4 d-grid">
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
                  Loading results...
                </div>
              ) : exams.length === 0 ? (
                <div className="card-body py-5 text-center text-muted">
                  No results found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Subject</th>
                        <th>Teacher</th>
                        <th>Class / Section</th>
                        <th>Academic Session</th>
                        <th>Exam Date</th>
                        <th>Status</th>
                        <th>Entered</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((exam) => (
                        <tr key={exam.id}>
                          <td className="fw-semibold">{exam.name}</td>
                          <td>{exam.subject_names || "-"}</td>
                          <td>{exam.teacher_names || "-"}</td>
                          <td>
                            {exam.classroom_name} / {exam.section_name}
                          </td>
                          <td>{exam.academic_session_name}</td>
                          <td>{exam.exam_date}</td>
                          <td>
                            <span className={statusClass(exam.status)}>
                              {exam.status}
                            </span>
                          </td>
                          <td>
                            {exam.results_entered} / {exam.eligible_students}
                            <div className="small text-muted">
                              {exam.pending_students} pending
                            </div>
                          </td>
                          <td>
                            <Link
                              className="btn btn-outline-primary btn-sm"
                              href={`/college-admin/results/${exam.id}`}
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
