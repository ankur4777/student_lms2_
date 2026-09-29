"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import NoticeFeed from "@/components/notices/NoticeFeed";
import SecureVideoPlayer from "@/components/student/SecureVideoPlayer";
import StudentIcon from "@/components/student/StudentIcon";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";

import "./dashboard.css";

type StudentFeatureKey =
  | "classes"
  | "recorded_classes"
  | "recorded_courses"
  | "attendance"
  | "assignments"
  | "results"
  | "documents"
  | "fees"
  | "notifications";

interface StudentInfo {
  username: string;
  name: string;
  admission_number: string;
  organization: string | null;
  classroom: string;
  section: string;
  roll_number: string;
}

interface AttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attended_classes: number;
  attendance_percentage: number;
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
  recording_public_id: string | null;
  recording_playback_url: string | null;
}

interface DashboardData {
  student: StudentInfo;
  attendance: AttendanceSummary;
  today_classes: LiveClass[];
  upcoming_classes: LiveClass[];
  recorded_classes: LiveClass[];
  feature_access?: Partial<Record<StudentFeatureKey, boolean>>;
}

function formatDate(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [selectedRecording, setSelectedRecording] =
    useState<LiveClass | null>(null);

  const handleShareRecording = async (publicId: string) => {
    const shareUrl =
      `${window.location.origin}/student/recordings/${publicId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Recording link copied!");
    } catch {
      setShareMessage("Unable to copy recording link.");
    }

    setTimeout(() => setShareMessage(""), 2500);
  };

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("student_access_token");

      if (!token) {
        router.replace("/student/login");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/student/dashboard/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
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
          setError(result.detail || "Unable to load dashboard.");
          return;
        }

        setData(result);
      } catch {
        setError("Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="student-dashboard student-dashboard-polished">
        <StudentSidebar />
        <main className="dashboard-main">
          <div className="dashboard-content">
            <div className="container-fluid">
              <div className="card">
                <div className="card-body py-5 text-center text-muted">
                  Loading dashboard...
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-dashboard student-dashboard-polished">
        <StudentSidebar />
        <main className="dashboard-main">
          <div className="dashboard-content">
            <div className="container-fluid">
              <div className="alert alert-danger">{error}</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const featureEnabled = (key: StudentFeatureKey) =>
    data.feature_access?.[key] !== false;

  const classesEnabled = featureEnabled("classes");
  const recordedClassesEnabled = featureEnabled("recorded_classes");
  const attendanceEnabled = featureEnabled("attendance");
  const assignmentsEnabled = featureEnabled("assignments");

  const quickLinks = [
    {
      label: "My Classes",
      href: "/student/classes",
      icon: "classes" as const,
      featureKey: "classes" as const,
    },
    {
      label: "Attendance",
      href: "/student/attendance",
      icon: "attendance" as const,
      featureKey: "attendance" as const,
    },
    {
      label: "Assignments",
      href: "/student/assignments",
      icon: "assignments" as const,
      featureKey: "assignments" as const,
    },
    {
      label: "Results",
      href: "/student/results",
      icon: "results" as const,
      featureKey: "results" as const,
    },
    {
      label: "Fees",
      href: "/student/fees",
      icon: "fees" as const,
      featureKey: "fees" as const,
    },
  ].filter((item) => featureEnabled(item.featureKey));

  const showOverview =
    attendanceEnabled || classesEnabled || recordedClassesEnabled;
  const showPrimaryPanels = classesEnabled || attendanceEnabled;
  const showSecondaryPanels =
    recordedClassesEnabled || quickLinks.length > 0;

  return (
    <div className="student-dashboard student-dashboard-polished">
      {shareMessage && <div className="share-toast">{shareMessage}</div>}

      <StudentSidebar />

      <main className="dashboard-main">
        <StudentTopbar
          name={data.student.name}
          organization={data.student.organization || ""}
        />

        <div className="dashboard-content">
          <div className="container-fluid">
            <section className="student-welcome">
              <div>
                <div className="student-welcome-kicker">
                  STUDENT PORTAL
                </div>

                <h1>
                  Welcome back,{" "}
                  {data.student.name || data.student.username}
                </h1>

                <p>
                  {data.student.classroom || "Your class"}
                  {data.student.section
                    ? ` · Section ${data.student.section}`
                    : ""}
                  {data.student.roll_number
                    ? ` · Roll ${data.student.roll_number}`
                    : ""}
                </p>
              </div>

              {(classesEnabled || assignmentsEnabled) && (
                <div className="student-welcome-actions">
                  {classesEnabled && (
                    <Link
                      className="btn btn-primary"
                      href="/student/classes"
                    >
                      <StudentIcon name="classes" size={16} />
                      My Classes
                    </Link>
                  )}

                  {assignmentsEnabled && (
                    <Link
                      className="btn btn-outline-primary"
                      href="/student/assignments"
                    >
                      <StudentIcon name="assignments" size={16} />
                      Assignments
                    </Link>
                  )}
                </div>
              )}
            </section>

            {showOverview && (
              <section className="student-overview-grid">
                {attendanceEnabled && (
                  <>
                    <div className="student-overview-card">
                      <span className="student-overview-icon">
                        <StudentIcon name="classes" size={20} />
                      </span>

                      <div className="student-overview-copy">
                        <small>Total Classes</small>
                        <strong>{data.attendance.total_classes}</strong>
                        <span>Attendance records</span>
                      </div>
                    </div>

                    <div className="student-overview-card">
                      <span className="student-overview-icon">
                        <StudentIcon name="attendance" size={20} />
                      </span>

                      <div className="student-overview-copy">
                        <small>Attendance</small>
                        <strong>
                          {data.attendance.attendance_percentage}%
                        </strong>
                        <span>Overall attendance</span>
                      </div>
                    </div>
                  </>
                )}

                {classesEnabled && (
                  <div className="student-overview-card">
                    <span className="student-overview-icon">
                      <StudentIcon name="clock" size={20} />
                    </span>

                    <div className="student-overview-copy">
                      <small>Upcoming Classes</small>
                      <strong>{data.upcoming_classes.length}</strong>
                      <span>Scheduled classes</span>
                    </div>
                  </div>
                )}

                {recordedClassesEnabled && (
                  <div className="student-overview-card">
                    <span className="student-overview-icon">
                      <StudentIcon name="recordings" size={20} />
                    </span>

                    <div className="student-overview-copy">
                      <small>Recorded Classes</small>
                      <strong>{data.recorded_classes.length}</strong>
                      <span>Available recordings</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {showPrimaryPanels && (
              <section className="student-dashboard-grid">
                {classesEnabled && (
                  <article className="student-panel">
                    <div className="student-panel-header">
                      <div>
                        <h2>Today&apos;s Classes</h2>
                        <p>Your classes and joining links for today.</p>
                      </div>

                      <Link href="/student/classes">View all</Link>
                    </div>

                    <div className="student-class-list">
                      {data.today_classes.length === 0 ? (
                        <div className="text-muted small p-3">
                          No classes scheduled for today.
                        </div>
                      ) : (
                        data.today_classes.map((liveClass) => (
                          <div
                            className="student-class-item"
                            key={liveClass.id}
                          >
                            <div>
                              <strong>{liveClass.title}</strong>

                              <small>
                                {liveClass.subject_name}
                                {liveClass.teacher_name
                                  ? ` · ${liveClass.teacher_name}`
                                  : ""}
                              </small>

                              <small>
                                {liveClass.start_time} -{" "}
                                {liveClass.end_time}
                              </small>
                            </div>

                            {liveClass.meeting_link && (
                              <a
                                className="btn btn-primary btn-sm"
                                href={liveClass.meeting_link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Join Class
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                )}

                {attendanceEnabled && (
                  <article className="student-panel">
                    <div className="student-panel-header">
                      <div>
                        <h2>Attendance Summary</h2>
                        <p>Your current attendance position.</p>
                      </div>

                      <Link href="/student/attendance">
                        View details
                      </Link>
                    </div>

                    <div className="student-attendance-panel">
                      <div className="student-attendance-score">
                        <strong>
                          {data.attendance.attendance_percentage}%
                        </strong>
                        <span>Overall Attendance</span>
                      </div>

                      <div className="student-attendance-grid">
                        <div className="student-attendance-stat">
                          <strong>{data.attendance.present}</strong>
                          <span>Present</span>
                        </div>

                        <div className="student-attendance-stat">
                          <strong>{data.attendance.absent}</strong>
                          <span>Absent</span>
                        </div>

                        <div className="student-attendance-stat">
                          <strong>{data.attendance.late}</strong>
                          <span>Late</span>
                        </div>

                        <div className="student-attendance-stat">
                          <strong>{data.attendance.excused}</strong>
                          <span>Excused</span>
                        </div>
                      </div>
                    </div>
                  </article>
                )}
              </section>
            )}

            {showSecondaryPanels && (
              <section className="student-dashboard-grid">
                {recordedClassesEnabled && (
                  <article className="student-panel">
                    <div className="student-panel-header">
                      <div>
                        <h2>Recent Recordings</h2>
                        <p>
                          Watch your latest available class recordings.
                        </p>
                      </div>

                      <Link href="/student/recorded-classes">
                        View all
                      </Link>
                    </div>

                    <div className="student-recording-list">
                      {data.recorded_classes.length === 0 ? (
                        <div className="text-muted small p-3">
                          No recorded classes available.
                        </div>
                      ) : (
                        data.recorded_classes
                          .slice(0, 4)
                          .map((recording) => (
                            <div
                              className="student-recording-item"
                              key={recording.id}
                            >
                              <div>
                                <strong>{recording.title}</strong>

                                <small>
                                  {recording.subject_name} ·{" "}
                                  {formatDate(recording.class_date)}
                                </small>
                              </div>

                              {recording.recording_playback_url && (
                                <div className="d-flex gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() =>
                                      setSelectedRecording(recording)
                                    }
                                  >
                                    Watch
                                  </button>

                                  {recording.recording_public_id && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={() =>
                                        void handleShareRecording(
                                          recording.recording_public_id!
                                        )
                                      }
                                    >
                                      Share
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </article>
                )}

                {quickLinks.length > 0 && (
                  <article className="student-panel">
                    <div className="student-panel-header">
                      <div>
                        <h2>Quick Access</h2>
                        <p>Open the areas you use most often.</p>
                      </div>
                    </div>

                    <div className="student-quick-links">
                      {quickLinks.map((item) => (
                        <Link
                          className="student-quick-link"
                          href={item.href}
                          key={item.href}
                        >
                          <span>
                            <StudentIcon
                              name={item.icon}
                              size={17}
                            />
                            <span>{item.label}</span>
                          </span>

                          <StudentIcon name="arrow" size={15} />
                        </Link>
                      ))}
                    </div>
                  </article>
                )}
              </section>
            )}

            <NoticeFeed
              tokenKey="student_access_token"
              loginPath="/student/login"
            />
          </div>
        </div>
      </main>

      {recordedClassesEnabled &&
        selectedRecording &&
        selectedRecording.recording_playback_url && (
          <SecureVideoPlayer
            playbackUrl={selectedRecording.recording_playback_url}
            title={selectedRecording.title}
            onClose={() => setSelectedRecording(null)}
          />
        )}
    </div>
  );
}
