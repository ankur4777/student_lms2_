"use client";

import { useEffect, useMemo, useState } from "react";
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

interface LiveClass {
  id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  teacher_name: string;
  subject_name: string;
  section_name: string;
}

type ClassFilter = "all" | "today" | "upcoming" | "completed";

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

function getClassCategory(liveClass: LiveClass) {
  const today = new Date().toISOString().slice(0, 10);

  if (liveClass.status === "completed") {
    return "completed";
  }

  if (liveClass.class_date === today) {
    return "today";
  }

  if (liveClass.class_date > today) {
    return "upcoming";
  }

  return "completed";
}

export default function StudentClassesPage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    async function loadClasses() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE}/api/live-classes/student/classes/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || "Unable to load classes.");
        }

        setClasses(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load classes."
        );
      } finally {
        setLoading(false);
      }
    }

    loadClasses();
  }, [router]);

  const filteredClasses = useMemo(() => {
    if (filter === "all") {
      return classes;
    }

    return classes.filter(
      (liveClass) => getClassCategory(liveClass) === filter
    );
  }, [classes, filter]);

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
              <StudentFeatureRestricted featureName="My Classes" />
            ) : (
              <div className="dashboard-panel">
              <div className="panel-heading">
                <h5>My Classes</h5>
                <span className="badge bg-primary">{classes.length}</span>
              </div>

              <div className="d-flex flex-wrap gap-2 mb-4">
                {[
                  ["all", "All"],
                  ["today", "Today"],
                  ["upcoming", "Upcoming"],
                  ["completed", "Completed"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      filter === value
                        ? "btn btn-primary btn-sm"
                        : "btn btn-outline-primary btn-sm"
                    }
                    onClick={() => setFilter(value as ClassFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading && <div className="empty-state">Loading classes...</div>}

              {error && <div className="alert alert-danger">{error}</div>}

              {!loading && !error && filteredClasses.length === 0 && (
                <div className="empty-state">No classes found.</div>
              )}

              {!loading && !error && filteredClasses.length > 0 && (
                <div className="row g-3">
                  {filteredClasses.map((liveClass) => (
                    <div key={liveClass.id} className="col-lg-4 col-md-6">
                      <div className="border rounded p-3 h-100">
                        <div className="d-flex justify-content-between gap-2 mb-2">
                          <h6 className="fw-bold mb-0">{liveClass.title}</h6>
                          <span className="badge bg-light text-dark border">
                            {liveClass.status}
                          </span>
                        </div>

                        <p className="text-muted small mb-2">
                          {liveClass.subject_name} • {liveClass.section_name}
                        </p>

                        <p className="small mb-1">
                          Teacher: {liveClass.teacher_name || "-"}
                        </p>

                        <p className="small mb-1">
                          Date: {liveClass.class_date}
                        </p>

                        <p className="small mb-3">
                          Time: {liveClass.start_time} - {liveClass.end_time}
                        </p>

                        {liveClass.description && (
                          <p className="text-muted small">
                            {liveClass.description}
                          </p>
                        )}

                        {liveClass.meeting_link &&
                          liveClass.status !== "completed" &&
                          liveClass.status !== "cancelled" && (
                            <a
                              href={liveClass.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                            >
                              Join Class
                            </a>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
