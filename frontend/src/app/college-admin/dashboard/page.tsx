"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import AdminIcon, { AdminIconName } from "@/components/college-admin/AdminIcon";

import "../../teacher/dashboard/dashboard.css";
import "./college-admin-dashboard.css";

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface OrganizationInfo {
  name: string;
  code: string;
  is_active: boolean;
}

interface Summary {
  total_students: number;
  total_teachers: number;
  total_parents: number;
  total_classes: number;
  total_sections: number;
  total_subjects: number;
  active_enrollments: number;
  total_teacher_assignments: number;
  total_live_classes: number;
  upcoming_live_classes: number;
  total_assignments: number;
  total_documents: number;
  total_exams: number;
  attendance_percentage: number;
}

interface RecentItemBase {
  teacher_name?: string;
  subject_name?: string;
  classroom_name?: string;
  section_name?: string;
  status?: string;
}

interface RecentLiveClass extends RecentItemBase {
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
}

interface RecentAssignment extends RecentItemBase {
  title: string;
  due_date: string;
  due_time: string | null;
  created_at: string;
}

interface RecentDocument extends RecentItemBase {
  title: string;
  document_type: string;
  created_at: string;
  published_at: string | null;
}

interface RecentExam extends RecentItemBase {
  name: string;
  exam_date: string;
  results_entered: number;
}

interface DashboardData {
  organization: OrganizationInfo;
  summary: Summary;
  recent_live_classes: RecentLiveClass[];
  recent_assignments: RecentAssignment[];
  recent_documents: RecentDocument[];
  recent_exams: RecentExam[];
}

interface ReportsOverview {
  attendance?: {
    overall_percentage?: number;
    present?: number;
    absent?: number;
    late?: number;
    excused?: number;
  };
  fees?: {
    total_expected_amount?: string | number;
    total_collected_amount?: string | number;
    total_pending_amount?: string | number;
  };
}

interface ClassPerformance {
  id: number;
  name: string;
  academic_session: string;
  students: number;
  sections: number;
  attendance_percentage: number;
  assignments: number;
  published_results: number;
}

interface ReportsDetails {
  classes?: ClassPerformance[];
}

interface Notice {
  id: number;
  title: string;
  message: string;
  audience: string;
  publish_at: string;
  expires_at?: string | null;
  is_active: boolean;
}

type IconName = AdminIconName;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function getSavedCollegeAdmin(): CollegeAdminUser {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function money(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function contextLine(item: RecentItemBase) {
  return [
    item.teacher_name,
    item.subject_name,
    item.classroom_name && item.section_name
      ? `${item.classroom_name} - ${item.section_name}`
      : item.classroom_name || item.section_name,
  ]
    .filter(Boolean)
    .join(" - ");
}

function noticeStatus(notice: Notice) {
  const now = new Date();
  const publish = new Date(notice.publish_at);
  const expiry = notice.expires_at ? new Date(notice.expires_at) : null;

  if (!notice.is_active) return { label: "Inactive", className: "neutral" };
  if (publish > now) return { label: "Scheduled", className: "info" };
  if (expiry && expiry <= now) return { label: "Expired", className: "dark" };
  return { label: "Active", className: "success" };
}

export default function CollegeAdminDashboardPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedCollegeAdmin);
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<ReportsOverview | null>(null);
  const [details, setDetails] = useState<ReportsDetails | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("college_admin_access_token");
    let mounted = true;

    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    const clearSession = () => {
      localStorage.removeItem("college_admin_access_token");
      localStorage.removeItem("college_admin_refresh_token");
      localStorage.removeItem("college_admin_user");
    };

    const authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    const fetchOptional = async (path: string) => {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: authHeaders,
      });
      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        throw new Error("Unauthorized");
      }
      if (!response.ok) return null;
      return response.json();
    };

    const loadDashboard = async () => {
      try {
        const dashboardResponse = await fetch(
          `${API_BASE}/api/accounts/college-admin/dashboard/`,
          { headers: authHeaders }
        );

        if (dashboardResponse.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const dashboardResult = await dashboardResponse.json();
        if (!dashboardResponse.ok) {
          throw new Error(
            dashboardResult?.detail ||
              "Unable to load college admin dashboard."
          );
        }

        const [reportsResult, detailsResult, noticesResult] =
          await Promise.all([
            fetchOptional("/api/reports/college-admin/overview/"),
            fetchOptional("/api/reports/college-admin/details/"),
            fetchOptional("/api/notices/college-admin/"),
          ]);

        if (!mounted) return;

        setData(dashboardResult);
        if (reportsResult) setReports(reportsResult);
        if (detailsResult) setDetails(detailsResult);
        if (Array.isArray(noticesResult)) setNotices(noticesResult);
      } catch (err) {
        if (mounted && err instanceof Error && err.message !== "Unauthorized") {
          setError(err.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  const attendance = clampPercent(
    Number(
      reports?.attendance?.overall_percentage ??
        data?.summary.attendance_percentage ??
        0
    )
  );
  const present = Number(reports?.attendance?.present || 0);
  const absent = Number(reports?.attendance?.absent || 0);
  const late = Number(reports?.attendance?.late || 0);
  const excused = Number(reports?.attendance?.excused || 0);

  const expectedFees = Number(reports?.fees?.total_expected_amount || 0);
  const collectedFees = Number(reports?.fees?.total_collected_amount || 0);
  const pendingFees = Number(reports?.fees?.total_pending_amount || 0);
  const feeCollectionPercent =
    expectedFees > 0
      ? clampPercent((collectedFees / expectedFees) * 100)
      : 0;

  const classRows = details?.classes?.slice(0, 4) || [];
  const recentNotices = useMemo(
    () =>
      [...notices]
        .sort(
          (a, b) =>
            new Date(b.publish_at).getTime() -
            new Date(a.publish_at).getTime()
        )
        .slice(0, 3),
    [notices]
  );

  const primaryCards = data
    ? [
        {
          label: "Total Students",
          value: data.summary.total_students,
          hint: "Registered students",
          href: "/college-admin/students",
          icon: "students" as IconName,
        },
        {
          label: "Total Teachers",
          value: data.summary.total_teachers,
          hint: "Faculty members",
          href: "/college-admin/teachers",
          icon: "teachers" as IconName,
        },
        {
          label: "Total Classes",
          value: data.summary.total_classes,
          hint: "Active classes",
          href: "/college-admin/classes",
          icon: "classes" as IconName,
        },
        {
          label: "Overall Attendance",
          value: `${Math.round(attendance)}%`,
          hint: "Current attendance",
          href: "/college-admin/attendance",
          icon: "attendance" as IconName,
        },
        {
          label: "Fees Collected",
          value: money(collectedFees),
          hint: "Current academic year",
          href: "/college-admin/fees",
          icon: "fees" as IconName,
        },
        {
          label: "Pending Fees",
          value: money(pendingFees),
          hint: "Outstanding amount",
          href: "/college-admin/fees",
          icon: "pending" as IconName,
        },
      ]
    : [];

  const snapshotCards = data
    ? [
        ["Parents", data.summary.total_parents, "/college-admin/parents", "parents"],
        ["Sections", data.summary.total_sections, "/college-admin/sections", "sections"],
        ["Subjects", data.summary.total_subjects, "/college-admin/subjects", "subjects"],
        ["Active Enrollments", data.summary.active_enrollments, "/college-admin/enrollments", "enrollments"],
        ["Teacher Assignments", data.summary.total_teacher_assignments, "/college-admin/teacher-assignments", "teachers"],
        ["Live Classes", data.summary.total_live_classes, "/college-admin/live-classes", "live"],
        ["Assignments", data.summary.total_assignments, "/college-admin/assignments", "assignments"],
        ["Documents", data.summary.total_documents, "/college-admin/documents", "documents"],
        ["Exams", data.summary.total_exams, "/college-admin/results", "results"],
      ] as [string, string | number, string, IconName][]
    : [];

  const quickActions = [
    ["Add Student", "/college-admin/students/create", "students"],
    ["Add Teacher", "/college-admin/teachers/create", "teachers"],
    ["Create Enrollment", "/college-admin/enrollments/create", "enrollments"],
    ["Assign Teacher", "/college-admin/teacher-assignments/create", "assignments"],
    ["Create Notice", "/college-admin/notices", "documents"],
    ["Generate Report", "/college-admin/reports", "results"],
  ] as [string, string, IconName][];

  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (loading) {
    return (
      <div className="teacher-dashboard college-admin-dashboard-redesign">
        <CollegeAdminSidebar />
        <main className="teacher-dashboard-main">
          <CollegeAdminTopbar
            name={admin.name || admin.username || "College Admin"}
            organization={admin.organization || ""}
          />
          <div className="teacher-dashboard-content">
            <div className="cad-loading-card">Loading dashboard...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard college-admin-dashboard-redesign">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={data?.organization.name || admin.organization || ""}
        />

        <div className="teacher-dashboard-content cad-page">
          <div className="container-fluid">
            {error && <div className="alert alert-danger">{error}</div>}

            {data && (
              <>
                <section className="cad-welcome">
                  <div>
                    <p className="cad-eyebrow">COLLEGE ADMIN PORTAL</p>
                    <h1>
                      Welcome back, {admin.name || admin.username || "Admin"}!
                    </h1>
                    <p>
                      Here&apos;s an overview of your college&apos;s academic activity.
                    </p>
                  </div>
                  <div className="cad-welcome-side">
                    <div className="cad-campus-art" aria-hidden="true"><span><AdminIcon name="classes" size={34} /></span><span><AdminIcon name="classes" size={48} /></span><span><AdminIcon name="classes" size={34} /></span></div>
                    <div className="cad-date">{today}</div>
                  </div>
                </section>

                <section className="cad-kpi-grid">
                  {primaryCards.map((card) => (
                    <Link key={card.label} href={card.href} className="cad-kpi-card">
                      <div className="cad-icon-box">
                        <AdminIcon name={card.icon} size={20} />
                      </div>
                      <div className="cad-kpi-copy">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <small>{card.hint}</small>
                      </div>
                    </Link>
                  ))}
                </section>

                <section className="cad-main-grid">
                  <article className="cad-panel cad-attendance-panel">
                    <div className="cad-panel-heading">
                      <div>
                        <span className="cad-panel-icon"><AdminIcon name="attendance" size={18} /></span>
                        <div>
                          <h2>Attendance Overview</h2>
                          <p>Present and late count toward attendance percentage.</p>
                        </div>
                      </div>
                      <Link href="/college-admin/attendance">View details</Link>
                    </div>

                    <div className="cad-attendance-body">
                      <div
                        className="cad-ring"
                        style={
                          {
                            "--cad-progress": `${attendance * 3.6}deg`,
                          } as CSSProperties
                        }
                      >
                        <div className="cad-ring-inner">
                          <strong>{Math.round(attendance)}%</strong>
                          <span>Overall Attendance</span>
                        </div>
                      </div>

                      <div className="cad-attendance-stats">
                        {[
                          ["Present", present, "success"],
                          ["Absent", absent, "danger"],
                          ["Late", late, "warning"],
                          ["Excused", excused, "neutral"],
                        ].map(([label, value, tone]) => (
                          <div
                            className={`cad-stat-tile ${tone}`}
                            key={String(label)}
                          >
                            <span className="cad-stat-dot" />
                            <div>
                              <strong>{value}</strong>
                              <small>{label}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="cad-panel cad-fee-panel">
                    <div className="cad-panel-heading">
                      <div>
                        <span className="cad-panel-icon"><AdminIcon name="fees" size={18} /></span>
                        <div>
                          <h2>Fee Collection Summary</h2>
                          <p>Overview of collected and pending fees.</p>
                        </div>
                      </div>
                      <Link href="/college-admin/fees">View fees</Link>
                    </div>

                    <div className="cad-fee-body">
                      <div
                        className="cad-fee-ring"
                        style={
                          {
                            "--cad-fee-progress": `${feeCollectionPercent * 3.6}deg`,
                          } as CSSProperties
                        }
                      >
                        <div>
                          <strong>{money(expectedFees)}</strong>
                          <span>Total Fees</span>
                        </div>
                      </div>

                      <div className="cad-fee-legend">
                        <div>
                          <span className="cad-legend-dot collected" />
                          <span>Collected Fees</span>
                          <strong>{money(collectedFees)}</strong>
                          <small>{Math.round(feeCollectionPercent)}%</small>
                        </div>
                        <div>
                          <span className="cad-legend-dot pending" />
                          <span>Pending Fees</span>
                          <strong>{money(pendingFees)}</strong>
                          <small>{Math.round(100 - feeCollectionPercent)}%</small>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="cad-panel cad-actions-panel">
                    <div className="cad-panel-heading">
                      <div>
                        <span className="cad-panel-icon"><AdminIcon name="actions" size={18} /></span>
                        <div>
                          <h2>Quick Actions</h2>
                          <p>Perform common administrative tasks quickly.</p>
                        </div>
                      </div>
                    </div>

                    <div className="cad-actions-grid">
                      {quickActions.map(([label, href, icon]) => (
                        <Link href={href} key={href} className="cad-action-tile">
                          <span className="cad-action-icon"><AdminIcon name={icon} size={18} /></span>
                          <strong>{label}</strong>
                          <span className="cad-action-arrow">→</span>
                        </Link>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="cad-secondary-grid">
                  <article className="cad-panel cad-table-panel">
                    <div className="cad-panel-heading compact">
                      <div>
                        <span className="cad-panel-icon"><AdminIcon name="classes" size={18} /></span>
                        <div>
                          <h2>Class-wise Performance</h2>
                          <p>Current academic overview across classes.</p>
                        </div>
                      </div>
                      <Link href="/college-admin/reports">View All →</Link>
                    </div>

                    <div className="table-responsive">
                      <table className="table cad-table align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Class</th>
                            <th>Students</th>
                            <th>Attendance</th>
                            <th>Assignments</th>
                            <th>Results</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classRows.length ? (
                            classRows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <strong>{row.name}</strong>
                                  <small>{row.academic_session}</small>
                                </td>
                                <td>{row.students}</td>
                                <td>{Math.round(row.attendance_percentage)}%</td>
                                <td>{row.assignments}</td>
                                <td>{row.published_results}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="cad-empty-cell">
                                No class analytics available yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="cad-panel cad-recent-payments">
                    <div className="cad-panel-heading compact">
                      <div>
                        <span className="cad-panel-icon">▰</span>
                        <div>
                          <h2>Recent Payments</h2>
                          <p>Latest fee payment activity.</p>
                        </div>
                      </div>
                      <Link href="/college-admin/fees">View All →</Link>
                    </div>

                    <div className="cad-empty-state">
                      <div className="cad-empty-icon"><AdminIcon name="fees" size={20} /></div>
                      <strong>No recent payment rows available</strong>
                      <span>
                        Fee totals above are live. Open Fees for student-level payment details.
                      </span>
                      <Link href="/college-admin/fees">Open Fees</Link>
                    </div>
                  </article>

                  <article className="cad-panel cad-notices">
                    <div className="cad-panel-heading compact">
                      <div>
                        <span className="cad-panel-icon"><AdminIcon name="notices" size={18} /></span>
                        <div>
                          <h2>Recent Notices</h2>
                          <p>Latest announcements for students and staff.</p>
                        </div>
                      </div>
                      <Link href="/college-admin/notices">View All →</Link>
                    </div>

                    <div className="cad-notice-list">
                      {recentNotices.length ? (
                        recentNotices.map((notice) => {
                          const status = noticeStatus(notice);
                          return (
                            <Link
                              href="/college-admin/notices"
                              className="cad-notice-item"
                              key={notice.id}
                            >
                              <span className={`cad-notice-dot ${status.className}`} />
                              <div>
                                <strong>{notice.title}</strong>
                                <small>{formatDate(notice.publish_at)}</small>
                              </div>
                              <span>›</span>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="cad-empty-state compact">
                          <strong>No notices available</strong>
                          <Link href="/college-admin/notices">Create Notice</Link>
                        </div>
                      )}
                    </div>
                  </article>
                </section>

                <section className="cad-panel cad-analytics-panel">
                  <div className="cad-panel-heading compact">
                    <div>
                      <span className="cad-panel-icon"><AdminIcon name="results" size={18} /></span>
                      <div>
                        <h2>Reports & Analytics</h2>
                        <p>Current visual snapshot of your institution&apos;s performance.</p>
                      </div>
                    </div>
                    <Link href="/college-admin/reports">Open Reports →</Link>
                  </div>

                  <div className="cad-analytics-grid">
                    <div className="cad-mini-chart">
                      <span>Students</span>
                      <strong>{data.summary.total_students}</strong>
                      <div className="cad-bar-track"><i style={{ width: "72%" }} /></div>
                      <small>Registered students</small>
                    </div>
                    <div className="cad-mini-chart">
                      <span>Attendance</span>
                      <strong>{Math.round(attendance)}%</strong>
                      <div className="cad-bar-track"><i style={{ width: `${attendance}%` }} /></div>
                      <small>Overall attendance</small>
                    </div>
                    <div className="cad-mini-chart">
                      <span>Fee Collection</span>
                      <strong>{Math.round(feeCollectionPercent)}%</strong>
                      <div className="cad-bar-track"><i style={{ width: `${feeCollectionPercent}%` }} /></div>
                      <small>{money(collectedFees)} collected</small>
                    </div>
                    <div className="cad-mini-chart">
                      <span>Classes</span>
                      <strong>{data.summary.total_classes}</strong>
                      <div className="cad-bar-track"><i style={{ width: data.summary.total_classes ? "68%" : "0%" }} /></div>
                      <small>{data.summary.total_sections} sections</small>
                    </div>
                  </div>
                </section>

                <section className="cad-panel cad-snapshot-panel">
                  <div className="cad-panel-heading compact">
                    <div>
                      <span className="cad-panel-icon"><AdminIcon name="classes" size={18} /></span>
                      <div>
                        <h2>Institution Snapshot</h2>
                        <p>Quick access to the rest of your existing dashboard metrics.</p>
                      </div>
                    </div>
                  </div>
                  <div className="cad-snapshot-grid">
                    {snapshotCards.map(([label, value, href, icon]) => (
                      <Link href={href} key={href} className="cad-snapshot-card">
                        <span className="cad-snapshot-icon"><AdminIcon name={icon} size={18} /></span>
                        <div>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="cad-activity-grid">
                  <div className="cad-panel">
                    <div className="cad-panel-heading compact">
                      <div><h2>Recent Live Classes</h2></div>
                      <Link href="/college-admin/live-classes">View All</Link>
                    </div>
                    {data.recent_live_classes.length ? (
                      data.recent_live_classes.slice(0, 3).map((item) => (
                        <div className="cad-activity-row" key={`${item.title}-${item.class_date}-${item.start_time}`}>
                          <div><strong>{item.title}</strong><small>{contextLine(item)}</small></div>
                          <span>{formatDate(item.class_date)} {formatTime(item.start_time)}</span>
                        </div>
                      ))
                    ) : <div className="cad-empty-state compact">No recent live classes.</div>}
                  </div>

                  <div className="cad-panel">
                    <div className="cad-panel-heading compact">
                      <div><h2>Recent Assignments</h2></div>
                      <Link href="/college-admin/assignments">View All</Link>
                    </div>
                    {data.recent_assignments.length ? (
                      data.recent_assignments.slice(0, 3).map((item) => (
                        <div className="cad-activity-row" key={`${item.title}-${item.created_at}`}>
                          <div><strong>{item.title}</strong><small>{contextLine(item)}</small></div>
                          <span>Due {formatDate(item.due_date)}</span>
                        </div>
                      ))
                    ) : <div className="cad-empty-state compact">No recent assignments.</div>}
                  </div>

                  <div className="cad-panel">
                    <div className="cad-panel-heading compact">
                      <div><h2>Recent Documents</h2></div>
                      <Link href="/college-admin/documents">View All</Link>
                    </div>
                    {data.recent_documents.length ? (
                      data.recent_documents.slice(0, 3).map((item) => (
                        <div className="cad-activity-row" key={`${item.title}-${item.created_at}`}>
                          <div><strong>{item.title}</strong><small>{item.document_type.replace("_", " ")}</small></div>
                          <span>{formatDate(item.published_at || item.created_at)}</span>
                        </div>
                      ))
                    ) : <div className="cad-empty-state compact">No recent documents.</div>}
                  </div>

                  <div className="cad-panel">
                    <div className="cad-panel-heading compact">
                      <div><h2>Recent Exams / Results</h2></div>
                      <Link href="/college-admin/results">View All</Link>
                    </div>
                    {data.recent_exams.length ? (
                      data.recent_exams.slice(0, 3).map((item) => (
                        <div className="cad-activity-row" key={`${item.name}-${item.exam_date}`}>
                          <div><strong>{item.name}</strong><small>{item.classroom_name} - {item.section_name}</small></div>
                          <span>{item.results_entered} results</span>
                        </div>
                      ))
                    ) : <div className="cad-empty-state compact">No recent exams or results.</div>}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
