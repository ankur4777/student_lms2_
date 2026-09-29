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
  class_id?: number;
  academic_session_id?: number;
}

interface SetupData {
  academic_sessions: FilterOption[];
  classes: FilterOption[];
  sections: FilterOption[];
  subjects: FilterOption[];
  teachers: FilterOption[];
}

interface Summary {
  total_sessions: number;
  total_records: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
}

interface AttendanceSession {
  id: number;
  date: string;
  start_time: string | null;
  teacher_name: string;
  subject_name: string;
  class_name: string;
  section_name: string;
  topic: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
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

export default function CollegeAdminAttendancePage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [setup, setSetup] = useState<SetupData>({
    academic_sessions: [],
    classes: [],
    sections: [],
    subjects: [],
    teachers: [],
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [academicSession, setAcademicSession] = useState("");
  const [classroom, setClassroom] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [date, setDate] = useState("");
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
      throw new Error(result.detail || "Unable to load attendance.");
    }

    return result;
  }, [clearSession, router]);

  const buildUrl = useCallback((path: string) => {
    const url = new URL(`${API_BASE}${path}`);

    if (academicSession) {
      url.searchParams.set("academic_session", academicSession);
    }
    if (classroom) {
      url.searchParams.set("class", classroom);
    }
    if (section) {
      url.searchParams.set("section", section);
    }
    if (subject) {
      url.searchParams.set("subject", subject);
    }
    if (teacher) {
      url.searchParams.set("teacher", teacher);
    }
    if (date) {
      url.searchParams.set("date", date);
    }

    return url.toString();
  }, [academicSession, classroom, date, section, subject, teacher]);

  const loadAttendance = useCallback(async () => {
    const [summaryResult, sessionsResult] = await Promise.all([
      fetchJson(buildUrl("/api/attendance/college-admin/summary/")),
      fetchJson(buildUrl("/api/attendance/college-admin/sessions/")),
    ]);

    setSummary(summaryResult);
    setSessions(sessionsResult.sessions || []);
  }, [buildUrl, fetchJson]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const setupResult = await fetchJson(
          `${API_BASE}/api/attendance/college-admin/setup/`
        );
        if (isMounted) {
          setSetup(setupResult);
        }
        await loadAttendance();
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
  }, [fetchJson, loadAttendance]);

  const applyFilters = async () => {
    setLoading(true);
    setError("");

    try {
      await loadAttendance();
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
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
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">Attendance</h2>
                <p className="text-muted mb-0">
                  Monitor attendance across your institution.
                </p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3 mb-4">
              {[
                ["Total Sessions", summary?.total_sessions ?? 0],
                ["Attendance Records", summary?.total_records ?? 0],
                ["Present", summary?.present ?? 0],
                ["Absent", summary?.absent ?? 0],
                ["Late", summary?.late ?? 0],
                ["Attendance %", `${summary?.attendance_percentage ?? 0}%`],
              ].map(([label, value]) => (
                <div key={label} className="col-xl-2 col-md-4 col-6">
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
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-lg-2 col-md-4">
                    <select
                      className="form-select"
                      value={academicSession}
                      onChange={(event) =>
                        setAcademicSession(event.target.value)
                      }
                    >
                      <option value="">Academic Session</option>
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
                      value={classroom}
                      onChange={(event) => setClassroom(event.target.value)}
                    >
                      <option value="">Class</option>
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
                      <option value="">Section</option>
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
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      <option value="">Subject</option>
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
                      value={teacher}
                      onChange={(event) => setTeacher(event.target.value)}
                    >
                      <option value="">Teacher</option>
                      {setup.teachers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-lg-2 col-md-4">
                    <input
                      className="form-control"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={applyFilters}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body">
                {loading ? (
                  <div className="p-4">Loading attendance...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    No attendance sessions found.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Teacher</th>
                          <th>Subject</th>
                          <th>Class / Section</th>
                          <th>Topic</th>
                          <th>Present</th>
                          <th>Absent</th>
                          <th>Late</th>
                          <th>Attendance %</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              {session.date}
                              <div className="small text-muted">
                                {formatTime(session.start_time)}
                              </div>
                            </td>
                            <td>{session.teacher_name}</td>
                            <td>{session.subject_name}</td>
                            <td>
                              {session.class_name} / {session.section_name}
                            </td>
                            <td>{session.topic || "-"}</td>
                            <td>{session.present}</td>
                            <td>{session.absent}</td>
                            <td>{session.late}</td>
                            <td>{session.attendance_percentage}%</td>
                            <td>
                              <Link
                                href={`/college-admin/attendance/sessions/${session.id}`}
                                className="btn btn-outline-primary btn-sm"
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
        </div>
      </main>
    </div>
  );
}
