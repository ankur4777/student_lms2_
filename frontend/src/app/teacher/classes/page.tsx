"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import "../dashboard/dashboard.css";

interface TeacherClass {
  id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  category: string;
  subject_name: string;
  section_name: string;
  classroom_name: string;
  has_recording: boolean;
  can_start: boolean;
  can_complete: boolean;
}

interface ClassesResponse {
  count: number;
  classes: TeacherClass[];
}

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

function getSavedTeacher() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedTeacher = localStorage.getItem("teacher_user");

  if (!savedTeacher) {
    return {};
  }

  try {
    return JSON.parse(savedTeacher);
  } catch {
    return {};
  }
}

export default function TeacherClassesPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    const fetchClasses = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/live-classes/teacher/classes/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("teacher_access_token");
          localStorage.removeItem("teacher_refresh_token");
          localStorage.removeItem("teacher_user");

          router.replace("/teacher/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail || "Unable to load classes."
          );
        }

        const data = result as ClassesResponse;

        setClasses(data.classes);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load classes."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, [router]);

  const filteredClasses =
    filter === "all"
      ? classes
      : classes.filter(
          (liveClass) => liveClass.category === filter
        );

  const updateClassStatus = async (
    liveClass: TeacherClass,
    nextStatus: "live" | "completed"
  ) => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setUpdatingId(liveClass.id);
      setError("");
      setMessage("");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/live-classes/teacher/classes/${liveClass.id}/status/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("teacher_access_token");
        localStorage.removeItem("teacher_refresh_token");
        localStorage.removeItem("teacher_user");

        router.replace("/teacher/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to update class status."
        );
      }

      setClasses((items) =>
        items.map((item) =>
          item.id === liveClass.id
            ? {
                ...item,
                status: result.class.status,
                category:
                  result.class.status === "completed"
                    ? "completed"
                    : item.category,
                can_start: result.class.can_start,
                can_complete: result.class.can_complete,
              }
            : item
        )
      );

      setMessage(result.message || "Class status updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update class status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={teacher.name || teacher.username || "Teacher"}
          organization={teacher.organization || ""}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">

            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">My Classes</h2>

                <p className="text-muted mb-0">
                  View and manage your assigned classes.
                </p>
              </div>

              <span className="badge bg-primary fs-6">
                {classes.length} Classes
              </span>
            </div>

            {/* FILTER BUTTONS */}
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
                      ? "btn btn-primary"
                      : "btn btn-outline-primary"
                  }
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading && (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  Loading classes...
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {message && (
              <div className="alert alert-success">
                {message}
              </div>
            )}

            {!loading &&
              !error &&
              filteredClasses.length === 0 && (
                <div className="card border-0 shadow-sm">
                  <div className="card-body text-center py-5">
                    <h5>No classes found</h5>

                    <p className="text-muted mb-0">
                      There are no classes in this category.
                    </p>
                  </div>
                </div>
              )}

            {!loading &&
              !error &&
              filteredClasses.map((liveClass) => (
                <div
                  key={liveClass.id}
                  className="card border-0 shadow-sm mb-3"
                >
                  <div className="card-body p-4">

                    <div className="d-flex justify-content-between gap-3 flex-wrap">

                      <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <h5 className="fw-bold mb-0">
                            {liveClass.title}
                          </h5>

                          <span className="badge bg-light text-dark border">
                            {liveClass.status}
                          </span>
                        </div>

                        <div className="text-muted mb-2">
                          {liveClass.subject_name}
                          {" • "}
                          {liveClass.classroom_name}
                          {" • "}
                          {liveClass.section_name}
                        </div>

                        <div className="small">
                          <strong>Date:</strong>{" "}
                          {liveClass.class_date}
                        </div>

                        <div className="small mt-1">
                          <strong>Time:</strong>{" "}
                          {liveClass.start_time} -{" "}
                          {liveClass.end_time}
                        </div>

                        {liveClass.description && (
                          <p className="text-muted mt-3 mb-0">
                            {liveClass.description}
                          </p>
                        )}
                      </div>

                      <div className="d-flex align-items-start gap-2">

                        {liveClass.has_recording && (
                          <span className="badge bg-success">
                            Recording Available
                          </span>
                        )}

                        {liveClass.meeting_link &&
                          liveClass.status !== "completed" && (
                            <a
                              href={liveClass.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm"
                            >
                              Open Class
                            </a>
                          )}

                        {liveClass.can_start && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            disabled={updatingId === liveClass.id}
                            onClick={() =>
                              updateClassStatus(liveClass, "live")
                            }
                          >
                            {updatingId === liveClass.id
                              ? "Updating..."
                              : "Start Class"}
                          </button>
                        )}

                        {liveClass.can_complete && (
                          <button
                            type="button"
                            className="btn btn-outline-success btn-sm"
                            disabled={updatingId === liveClass.id}
                            onClick={() =>
                              updateClassStatus(liveClass, "completed")
                            }
                          >
                            {updatingId === liveClass.id
                              ? "Updating..."
                              : "Mark Completed"}
                          </button>
                        )}

                      </div>
                    </div>

                  </div>
                </div>
              ))}

          </div>
        </div>
      </main>
    </div>
  );
}
