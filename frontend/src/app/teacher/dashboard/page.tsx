"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import TeacherIcon from "@/components/teacher/TeacherIcon";
import NoticeFeed from "@/components/notices/NoticeFeed";

import "./dashboard.css";

interface TeacherInfo {
  username: string;
  name: string;
  organization: string;
}

interface Summary {
  assigned_classes: number;
  today_classes: number;
  upcoming_classes: number;
  recordings: number;
}

interface Assignment {
  id: number;
  subject_name: string;
  section_name: string;
}

interface TeacherClass {
  id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  subject_name: string;
  section_name: string;
}

interface Recording {
  public_id: string;
  title: string;
  class_title: string;
  class_date: string;
  subject_name: string;
  section_name: string;
  is_available: boolean;
  uploaded_at: string;
}

interface TeacherDashboardData {
  teacher: TeacherInfo;
  summary: Summary;
  assignments: Assignment[];
  today_classes: TeacherClass[];
  upcoming_classes: TeacherClass[];
  recordings: Recording[];
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("teacher_access_token");

      if (!token) {
        router.replace("/teacher/login");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/teacher/dashboard/`,
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
          setError(result.detail || "Unable to load teacher dashboard.");
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
      <div className="teacher-dashboard teacher-dashboard-polished">
        <TeacherSidebar />
        <main className="teacher-dashboard-main">
          <div className="teacher-dashboard-content">
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
      <div className="teacher-dashboard teacher-dashboard-polished">
        <TeacherSidebar />
        <main className="teacher-dashboard-main">
          <div className="teacher-dashboard-content">
            <div className="container-fluid">
              <div className="alert alert-danger">{error}</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const quickLinks = [
    { label: "My Classes", href: "/teacher/classes", icon: "classes" as const },
    { label: "Attendance", href: "/teacher/attendance", icon: "attendance" as const },
    { label: "Assignments", href: "/teacher/assignments", icon: "assignments" as const },
    { label: "Results", href: "/teacher/results", icon: "results" as const },
    { label: "Documents", href: "/teacher/documents", icon: "documents" as const },
  ];

  return (
    <div className="teacher-dashboard teacher-dashboard-polished">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={data.teacher.name}
          organization={data.teacher.organization}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <section className="teacher-welcome">
              <div>
                <div className="teacher-welcome-kicker">TEACHER PORTAL</div>
                <h1>Welcome back, {data.teacher.name || data.teacher.username}</h1>
                <p>
                  Manage today&apos;s teaching work, upcoming classes, attendance and academic tasks.
                </p>
              </div>

              <div className="teacher-welcome-actions">
                <Link className="btn btn-primary" href="/teacher/classes">
                  <TeacherIcon name="classes" size={16} />
                  My Classes
                </Link>
                <Link className="btn btn-outline-primary" href="/teacher/attendance">
                  <TeacherIcon name="attendance" size={16} />
                  Attendance
                </Link>
              </div>
            </section>

            <section className="teacher-overview-grid">
              <div className="teacher-overview-card">
                <span className="teacher-overview-icon">
                  <TeacherIcon name="assignments" size={20} />
                </span>
                <div>
                  <small>Teaching Assignments</small>
                  <strong>{data.summary.assigned_classes}</strong>
                  <span>Active subject and section assignments</span>
                </div>
              </div>

              <div className="teacher-overview-card">
                <span className="teacher-overview-icon">
                  <TeacherIcon name="calendar" size={20} />
                </span>
                <div>
                  <small>Today&apos;s Classes</small>
                  <strong>{data.summary.today_classes}</strong>
                  <span>Classes scheduled for today</span>
                </div>
              </div>

              <div className="teacher-overview-card">
                <span className="teacher-overview-icon">
                  <TeacherIcon name="clock" size={20} />
                </span>
                <div>
                  <small>Upcoming Classes</small>
                  <strong>{data.summary.upcoming_classes}</strong>
                  <span>Upcoming teaching sessions</span>
                </div>
              </div>

              <div className="teacher-overview-card">
                <span className="teacher-overview-icon">
                  <TeacherIcon name="recordings" size={20} />
                </span>
                <div>
                  <small>Recordings</small>
                  <strong>{data.summary.recordings}</strong>
                  <span>Uploaded recorded classes</span>
                </div>
              </div>
            </section>

            <section className="teacher-dashboard-grid">
              <article className="teacher-panel">
                <div className="teacher-panel-header">
                  <div>
                    <h2>Today&apos;s Classes</h2>
                    <p>Your schedule and quick class access for today.</p>
                  </div>
                  <Link href="/teacher/classes">View all</Link>
                </div>

                <div className="teacher-class-list">
                  {data.today_classes.length === 0 ? (
                    <div className="text-muted small p-3">
                      No classes scheduled for today.
                    </div>
                  ) : (
                    data.today_classes.map((liveClass) => (
                      <div className="teacher-class-item" key={liveClass.id}>
                        <div>
                          <strong>{liveClass.title}</strong>
                          <small>
                            {liveClass.subject_name} · {liveClass.section_name}
                          </small>
                          <div className="teacher-class-meta">
                            <span>{liveClass.start_time} - {liveClass.end_time}</span>
                            <span>{liveClass.status}</span>
                          </div>
                        </div>

                        {liveClass.meeting_link && (
                          <a
                            href={liveClass.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            Open Class
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="teacher-panel">
                <div className="teacher-panel-header">
                  <div>
                    <h2>Quick Access</h2>
                    <p>Open common teaching tasks quickly.</p>
                  </div>
                </div>

                <div className="teacher-quick-links">
                  {quickLinks.map((item) => (
                    <Link className="teacher-quick-link" href={item.href} key={item.href}>
                      <span>
                        <TeacherIcon name={item.icon} size={17} />
                        <span>{item.label}</span>
                      </span>
                      <TeacherIcon name="arrow" size={15} />
                    </Link>
                  ))}
                </div>
              </article>
            </section>

            <section className="teacher-dashboard-grid">
              <article className="teacher-panel">
                <div className="teacher-panel-header">
                  <div>
                    <h2>Teaching Assignments</h2>
                    <p>Subjects and sections currently assigned to you.</p>
                  </div>
                  <Link href="/teacher/profile">View profile</Link>
                </div>

                <div className="teacher-assignment-list">
                  {data.assignments.length === 0 ? (
                    <div className="text-muted small p-3">
                      No teaching assignments found.
                    </div>
                  ) : (
                    data.assignments.map((assignment) => (
                      <div className="teacher-assignment-item" key={assignment.id}>
                        <strong>{assignment.subject_name}</strong>
                        <small>{assignment.section_name}</small>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="teacher-panel">
                <div className="teacher-panel-header">
                  <div>
                    <h2>Recent Recordings</h2>
                    <p>Your latest uploaded recorded classes.</p>
                  </div>
                  <Link href="/teacher/recordings">View all</Link>
                </div>

                <div className="teacher-assignment-list">
                  {data.recordings.length === 0 ? (
                    <div className="text-muted small p-3">
                      No recordings uploaded.
                    </div>
                  ) : (
                    data.recordings.slice(0, 4).map((recording) => (
                      <div className="teacher-assignment-item" key={recording.public_id}>
                        <strong>{recording.title}</strong>
                        <small>
                          {recording.subject_name} · {recording.section_name} · {formatDate(recording.class_date)}
                        </small>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

            <div className="teacher-notice-wrap">
              <NoticeFeed
                tokenKey="teacher_access_token"
                loginPath="/teacher/login"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
