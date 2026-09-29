"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, {
  isClassFeatureRestricted,
} from "@/components/student/StudentFeatureRestricted";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type StudentUser = {
  username?: string;
  name?: string;
  organization?: string;
};

type RecordedClass = {
  id: number;
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
  subject_name: string;
  section_name: string;
  recording_public_id: string | null;
};

type PurchasedCourse = {
  id: number;
  title: string;
  description: string;
  access_expires_at: string | null;
  lessons: {
    id: number;
    title: string;
    description: string;
    position: number;
    is_active: boolean;
  }[];
};

function getSavedStudent(): StudentUser {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("student_user") || "{}");
  } catch {
    return {};
  }
}

export default function StudentRecordedClassesPage() {
  const router = useRouter();
  const [student] = useState<StudentUser>(getSavedStudent);
  const [classes, setClasses] = useState<RecordedClass[]>([]);
  const [courses, setCourses] = useState<PurchasedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    const clearSession = () => {
      localStorage.removeItem("student_access_token");
      localStorage.removeItem("student_refresh_token");
      localStorage.removeItem("student_user");
    };

    async function load() {
      try {
        setLoading(true);
        setError("");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [recordingsResponse, coursesResponse] = await Promise.all([
          fetch(`${API_BASE}/api/live-classes/student/recorded/`, {
            headers,
          }),
          fetch(`${API_BASE}/api/recorded-courses/student/my-courses/`, {
            headers,
          }),
        ]);

        if (
          recordingsResponse.status === 401 ||
          coursesResponse.status === 401
        ) {
          clearSession();
          router.replace("/student/login");
          return;
        }

        const recordingsResult = await recordingsResponse.json();

        if (!recordingsResponse.ok) {
          throw new Error(
            recordingsResult.detail || "Unable to load recorded classes."
          );
        }

        setClasses(recordingsResult || []);

        const coursesResult = await coursesResponse.json();

        if (coursesResponse.ok) {
          setCourses(coursesResult.courses || []);
        } else if (isClassFeatureRestricted(coursesResult?.detail || "")) {
          // Recorded Courses can be restricted independently from
          // regular class recordings.
          setCourses([]);
        } else {
          throw new Error(
            coursesResult.detail || "Unable to load purchased courses."
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load recordings."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

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
              <StudentFeatureRestricted featureName="Recorded Classes" />
            ) : (
              <>
                <div className="dashboard-panel mb-4">
                  <div className="panel-heading">
                    <div>
                      <h5 className="mb-1">Purchased Recorded Courses</h5>
                      <small className="text-muted">
                        Courses unlocked after payment verification.
                      </small>
                    </div>
                    <span className="badge bg-success">{courses.length}</span>
                  </div>

                  {loading && (
                    <div className="text-muted mt-3 mb-2">Loading recordings...</div>
                  )}

                  {error && <div className="alert alert-danger">{error}</div>}

                  {!loading && !error && courses.length === 0 && (
                    <div className="text-muted mt-3 mb-2">
                      No purchased recorded courses with active access.
                    </div>
                  )}

                  {!loading && !error && courses.length > 0 && (
                    <div className="row g-3">
                      {courses.map((course) => (
                        <div
                          className="col-lg-4 col-md-6"
                          key={course.id}
                        >
                          <div className="border rounded p-3 h-100 d-flex flex-column">
                            <h5 className="fw-bold">{course.title}</h5>
                            <p className="text-muted flex-grow-1">
                              {course.description || "Recorded course"}
                            </p>
                            <p className="small mb-2">
                              Lessons: <strong>{course.lessons.length}</strong>
                            </p>
                            {course.access_expires_at && (
                              <p className="small mb-3">
                                Access until:{" "}
                                <strong>
                                  {new Date(
                                    course.access_expires_at
                                  ).toLocaleDateString()}
                                </strong>
                              </p>
                            )}
                            <Link
                              href={`/student/recorded-courses/${course.id}`}
                              className="btn btn-success btn-sm align-self-start"
                            >
                              Open Course
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h5 className="mb-1">Class Recordings</h5>
                      <small className="text-muted">
                        Recordings from your regular live classes.
                      </small>
                    </div>
                    <span className="badge bg-primary">{classes.length}</span>
                  </div>

                  {!loading && !error && classes.length === 0 && (
                    <div className="text-muted mt-3 mb-2">
                      No class recordings found.
                    </div>
                  )}

                  {!loading && !error && classes.length > 0 && (
                    <div className="row g-3">
                      {classes.map((recording) => (
                        <div
                          key={recording.id}
                          className="col-lg-4 col-md-6"
                        >
                          <div className="border rounded p-3 h-100">
                            <h6 className="fw-bold">{recording.title}</h6>
                            <p className="text-muted small mb-2">
                              {recording.subject_name} •{" "}
                              {recording.section_name}
                            </p>
                            <p className="small mb-1">
                              Teacher: {recording.teacher_name || "-"}
                            </p>
                            <p className="small mb-1">
                              Date: {recording.class_date}
                            </p>
                            <p className="small mb-3">
                              Time: {recording.start_time} -{" "}
                              {recording.end_time}
                            </p>

                            {recording.recording_public_id && (
                              <Link
                                href={`/student/recordings/${recording.recording_public_id}`}
                                className="btn btn-primary btn-sm"
                              >
                                Watch Recording
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
