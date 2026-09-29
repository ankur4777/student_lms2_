"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import ParentIcon from "@/components/parent/ParentIcon";
import NoticeFeed from "@/components/notices/NoticeFeed";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  relationship: string;
}

interface Assignment {
  status?: string;
  submission?: {
    status?: string;
  } | null;
}

interface AttendanceSummary {
  attendance_percentage?: number;
}

interface ExamResult {
  name?: string;
  exam_date?: string;
  percentage?: number;
  total_obtained?: number;
  total_maximum?: number;
}

type ParentFeatureKey =
  | "attendance"
  | "assignments"
  | "results"
  | "recorded_courses"
  | "fees";

interface ChildDashboard extends Child {
  attendancePercentage: number | null;
  pendingAssignments: number;
  latestResult: string;
  latestExamDate: string;
  featureAccess: Record<ParentFeatureKey, boolean>;
}

function getSavedParent() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("parent_user") || "{}");
  } catch {
    return {};
  }
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function getLatestResult(exams: ExamResult[]) {
  if (exams.length === 0) {
    return { latestResult: "-", latestExamDate: "" };
  }

  const latestExam = [...exams].sort((first, second) => {
    const firstDate = first.exam_date ? new Date(first.exam_date).getTime() : 0;
    const secondDate = second.exam_date ? new Date(second.exam_date).getTime() : 0;
    return secondDate - firstDate;
  })[0];

  if (typeof latestExam.percentage === "number") {
    return {
      latestResult: `${Math.round(latestExam.percentage)}%`,
      latestExamDate: latestExam.exam_date || "",
    };
  }

  if (
    typeof latestExam.total_obtained === "number" &&
    typeof latestExam.total_maximum === "number"
  ) {
    return {
      latestResult: `${latestExam.total_obtained}/${latestExam.total_maximum}`,
      latestExamDate: latestExam.exam_date || "",
    };
  }

  return {
    latestResult: latestExam.name || "-",
    latestExamDate: latestExam.exam_date || "",
  };
}

function initials(name: string) {
  const value = (name || "S").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : value.slice(0, 2)
  ).toUpperCase();
}

export default function ParentDashboardPage() {
  const router = useRouter();

  const [parent] = useState<ParentUser>(getSavedParent);
  const [children, setChildren] = useState<ChildDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const averageAttendance = useMemo(() => {
    const available = children
      .filter((child) => child.featureAccess.attendance)
      .map((child) => child.attendancePercentage)
      .filter((value): value is number => value !== null);

    if (available.length === 0) return null;

    return available.reduce((total, value) => total + value, 0) / available.length;
  }, [children]);

  const pendingAssignments = useMemo(
    () =>
      children
        .filter((child) => child.featureAccess.assignments)
        .reduce(
          (total, child) => total + child.pendingAssignments,
          0
        ),
    [children]
  );

  const latestResult = useMemo(() => {
    const childrenWithResults = children.filter(
      (child) =>
        child.featureAccess.results &&
        child.latestResult !== "-"
    );
    if (childrenWithResults.length === 0) return "-";

    const sortedChildren = [...childrenWithResults].sort((first, second) => {
      const firstDate = first.latestExamDate
        ? new Date(first.latestExamDate).getTime()
        : 0;
      const secondDate = second.latestExamDate
        ? new Date(second.latestExamDate).getTime()
        : 0;
      return secondDate - firstDate;
    });

    return sortedChildren[0].latestResult;
  }, [children]);

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    let isMounted = true;

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    const clearParentSession = () => {
      localStorage.removeItem("parent_access_token");
      localStorage.removeItem("parent_refresh_token");
      localStorage.removeItem("parent_user");
    };

    const fetchJson = async (url: string) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        throw new Error("Unauthorized");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.detail || "Unable to load dashboard data.");
      }

      return result;
    };

    const loadChildDetails = async (
      child: Child
    ): Promise<ChildDashboard> => {
      const childId = child.student_profile_id;

      const accessResult = await fetchJson(
        `${API_BASE}/api/academics/parent/student/${childId}/feature-access/`
      );

      const featureAccess = {
        attendance:
          accessResult.features?.attendance !== false,
        assignments:
          accessResult.features?.assignments !== false,
        results:
          accessResult.features?.results !== false,
        recorded_courses:
          accessResult.features?.recorded_courses !== false,
        fees:
          accessResult.features?.fees !== false,
      } satisfies Record<ParentFeatureKey, boolean>;

      const [attendance, assignments, results] =
        await Promise.allSettled([
          featureAccess.attendance
            ? fetchJson(
                `${API_BASE}/api/attendance/parent/student/${childId}/`
              )
            : Promise.resolve(null),
          featureAccess.assignments
            ? fetchJson(
                `${API_BASE}/api/assignments/parent/student/${childId}/`
              )
            : Promise.resolve(null),
          featureAccess.results
            ? fetchJson(
                `${API_BASE}/api/results/parent/student/${childId}/`
              )
            : Promise.resolve(null),
        ]);

      const attendanceValue =
        attendance.status === "fulfilled"
          ? attendance.value
          : null;
      const assignmentsValue =
        assignments.status === "fulfilled"
          ? assignments.value
          : null;
      const resultsValue =
        results.status === "fulfilled"
          ? results.value
          : null;

      const summary = attendanceValue
        ? (attendanceValue.summary as AttendanceSummary | null)
        : null;

      const assignmentList = assignmentsValue
        ? ((assignmentsValue.assignments as Assignment[] | undefined) || [])
        : [];

      const examList = resultsValue
        ? ((resultsValue.exams as ExamResult[] | undefined) || [])
        : [];

      const latest = getLatestResult(examList);

      return {
        ...child,
        featureAccess,
        attendancePercentage:
          typeof summary?.attendance_percentage === "number"
            ? summary.attendance_percentage
            : null,
        pendingAssignments: assignmentList.filter(
          (assignment) =>
            (
              assignment.status ||
              assignment.submission?.status ||
              "pending"
            ).toLowerCase() === "pending"
        ).length,
        latestResult: latest.latestResult,
        latestExamDate: latest.latestExamDate,
      };
    };

    const loadDashboard = async () => {
      try {
        const childResult = await fetchJson(
          `${API_BASE}/api/accounts/parent/children/`
        );
        const childList = (childResult.children || []) as Child[];
        const childDetails = await Promise.all(
          childList.map((child) => loadChildDetails(child))
        );

        if (isMounted) setChildren(childDetails);
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message === "Unauthorized" ? "" : err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const hasFeatureAccess = (featureKey: ParentFeatureKey) =>
    children.some(
      (child) => child.featureAccess[featureKey]
    );

  const attendanceAllowed = hasFeatureAccess("attendance");
  const assignmentsAllowed = hasFeatureAccess("assignments");
  const resultsAllowed = hasFeatureAccess("results");

  const quickLinks = [
    {
      label: "Attendance",
      description: "Review daily attendance",
      href: "/parent/attendance",
      icon: "attendance" as const,
      featureKey: "attendance" as const,
    },
    {
      label: "Assignments",
      description: "Check pending work",
      href: "/parent/assignments",
      icon: "assignments" as const,
      featureKey: "assignments" as const,
    },
    {
      label: "Results",
      description: "View exam performance",
      href: "/parent/results",
      icon: "results" as const,
      featureKey: "results" as const,
    },
    {
      label: "Fees",
      description: "Track payment status",
      href: "/parent/fees",
      icon: "fees" as const,
      featureKey: "fees" as const,
    },
    {
      label: "Recorded Courses",
      description: "Browse recorded learning",
      href: "/parent/recorded-courses",
      icon: "courses" as const,
      featureKey: "recorded_courses" as const,
    },
  ].filter((item) => hasFeatureAccess(item.featureKey));

  return (
    <div className="student-dashboard parent-dashboard-polished">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={parent.name || parent.username || "Parent"}
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            <section className="parent-welcome">
              <div>
                <div className="parent-welcome-kicker">PARENT PORTAL</div>
                <h1>
                  Welcome back, {parent.name || parent.username || "Parent"}
                </h1>
                <p>
                  Keep track of your child&apos;s attendance, assignments, results and academic updates.
                </p>
              </div>

              <div className="parent-welcome-actions">
                <Link className="btn btn-primary" href="/parent/children">
                  <ParentIcon name="children" size={16} />
                  My Children
                </Link>
                <Link className="btn btn-outline-primary" href="/parent/notifications">
                  <ParentIcon name="notifications" size={16} />
                  Notifications
                </Link>
              </div>
            </section>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card">
                <div className="card-body py-5 text-center text-muted">
                  Loading dashboard...
                </div>
              </div>
            ) : (
              <>
                <section className="parent-overview-grid">
                  <div className="parent-overview-card">
                    <span className="parent-overview-icon">
                      <ParentIcon name="children" size={20} />
                    </span>
                    <div>
                      <small>Linked Children</small>
                      <strong>{children.length}</strong>
                      <span>Students connected to your account</span>
                    </div>
                  </div>

                  {attendanceAllowed && (
                    <div className="parent-overview-card">
                      <span className="parent-overview-icon">
                        <ParentIcon name="attendance" size={20} />
                      </span>
                      <div>
                        <small>Average Attendance</small>
                        <strong>{formatPercent(averageAttendance)}</strong>
                        <span>Across allowed linked children</span>
                      </div>
                    </div>
                  )}

                  {assignmentsAllowed && (
                    <div className="parent-overview-card">
                      <span className="parent-overview-icon">
                        <ParentIcon name="assignments" size={20} />
                      </span>
                      <div>
                        <small>Pending Assignments</small>
                        <strong>{pendingAssignments}</strong>
                        <span>Work still awaiting submission</span>
                      </div>
                    </div>
                  )}

                  {resultsAllowed && (
                    <div className="parent-overview-card">
                      <span className="parent-overview-icon">
                        <ParentIcon name="results" size={20} />
                      </span>
                      <div>
                        <small>Latest Result</small>
                        <strong>{latestResult}</strong>
                        <span>Most recently published performance</span>
                      </div>
                    </div>
                  )}
                </section>

                <section className="parent-dashboard-grid">
                  <article className="parent-panel">
                    <div className="parent-panel-header">
                      <div>
                        <h2>My Children</h2>
                        <p>Quick academic snapshot for each linked child.</p>
                      </div>
                      <Link href="/parent/children">View all</Link>
                    </div>

                    <div className="parent-children-list">
                      {children.length === 0 ? (
                        <div className="text-muted small p-3">
                          No linked children found.
                        </div>
                      ) : (
                        children.map((child) => (
                          <div
                            className="parent-child-card"
                            key={child.student_profile_id}
                          >
                            <div className="parent-child-head">
                              <div className="parent-child-identity">
                                <span className="parent-child-avatar">
                                  {initials(child.name)}
                                </span>
                                <div>
                                  <strong>{child.name}</strong>
                                  <small>
                                    {child.classroom_name || "-"}
                                    {child.section_name
                                      ? ` · Section ${child.section_name}`
                                      : ""}
                                    {child.roll_number
                                      ? ` · Roll ${child.roll_number}`
                                      : ""}
                                  </small>
                                </div>
                              </div>

                              <span className="badge bg-primary">
                                {child.relationship || "-"}
                              </span>
                            </div>

                            {(child.featureAccess.attendance ||
                              child.featureAccess.assignments ||
                              child.featureAccess.results) && (
                              <div className="parent-child-stats">
                                {child.featureAccess.attendance && (
                                  <div className="parent-child-stat">
                                    <span>Attendance</span>
                                    <strong>
                                      {formatPercent(
                                        child.attendancePercentage
                                      )}
                                    </strong>
                                  </div>
                                )}

                                {child.featureAccess.assignments && (
                                  <div className="parent-child-stat">
                                    <span>Pending Assignments</span>
                                    <strong>
                                      {child.pendingAssignments}
                                    </strong>
                                  </div>
                                )}

                                {child.featureAccess.results && (
                                  <div className="parent-child-stat">
                                    <span>Latest Result</span>
                                    <strong>{child.latestResult}</strong>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="parent-child-actions">
                              {child.featureAccess.attendance && (
                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/attendance"
                                >
                                  Attendance
                                </Link>
                              )}

                              {child.featureAccess.assignments && (
                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/assignments"
                                >
                                  Assignments
                                </Link>
                              )}

                              {child.featureAccess.results && (
                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/results"
                                >
                                  Results
                                </Link>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  {quickLinks.length > 0 && (
                    <article className="parent-panel">
                      <div className="parent-panel-header">
                        <div>
                          <h2>Quick Access</h2>
                          <p>Open the areas parents use most often.</p>
                        </div>
                      </div>

                      <div className="parent-quick-links">
                        {quickLinks.map((item) => (
                          <Link
                            className="parent-quick-link"
                            href={item.href}
                            key={item.href}
                          >
                            <span>
                              <ParentIcon name={item.icon} size={17} />
                              <span>
                                {item.label}
                                <small className="d-block text-muted mt-1">
                                  {item.description}
                                </small>
                              </span>
                            </span>
                            <ParentIcon name="arrow" size={15} />
                          </Link>
                        ))}
                      </div>
                    </article>
                  )}
                </section>

                <div className="parent-notice-wrap">
                  <NoticeFeed
                    tokenKey="parent_access_token"
                    loginPath="/parent/login"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
