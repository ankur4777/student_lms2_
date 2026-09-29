"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface OverviewData {
  academic: {
    total_students?: number | null;
    total_teachers?: number | null;
    total_classes?: number | null;
    total_sections?: number | null;
    total_subjects?: number | null;
  };
  attendance: {
    overall_percentage?: number | null;
    present?: number | null;
    absent?: number | null;
    late?: number | null;
    excused?: number | null;
  };
  assignments: {
    total_assignments?: number | null;
    total_submissions?: number | null;
    expected_submissions?: number | null;
    pending_submissions?: number | null;
  };
  live_classes: {
    total_live_classes?: number | null;
    scheduled?: number | null;
    completed?: number | null;
    cancelled?: number | null;
  };
  fees: {
    total_expected_amount?: string | number | null;
    total_collected_amount?: string | number | null;
    total_pending_amount?: string | number | null;
    paid_count?: number | null;
    pending_count?: number | null;
  };
  results: Record<string, number | string | null | undefined>;
}

function getSavedAdmin(): AdminUser {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0);
}

function percentValue(value: number | null | undefined) {
  return `${numberValue(value).toFixed(2).replace(/\.00$/, "")}%`;
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function progressWidth(value: number | null | undefined) {
  return `${Math.min(Math.max(numberValue(value), 0), 100)}%`;
}

export default function CollegeAdminReportsPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<any>({ academic_sessions: [], classes: [], sections: [], subjects: [] });
  const [filters, setFilters] = useState({ academic_session: "", classroom: "", section: "", subject: "", date_from: "", date_to: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [details, setDetails] = useState<any>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) return;
    fetch(`${API_BASE}/api/reports/college-admin/filters/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.detail || "Unable to load report filters."); return j; })
      .then(setOptions).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("college_admin_access_token");

    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    const loadReports = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/reports/college-admin/overview/?${new URLSearchParams(Object.entries(appliedFilters).filter(([,v]) => v))}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail || "Unable to load reports overview."
          );
        }

        if (isMounted) {
          setData(result);
          const detailResponse = await fetch(`${API_BASE}/api/reports/college-admin/details/?${new URLSearchParams(Object.entries(appliedFilters).filter(([,v]) => v))}`, { headers: { Authorization: `Bearer ${token}` } });
          const detailResult = await detailResponse.json();
          if (!detailResponse.ok) throw new Error(detailResult?.detail || "Unable to load detailed analytics.");
          if (isMounted) setDetails(detailResult);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadReports();

    return () => {
      isMounted = false;
    };
  }, [clearSession, router, appliedFilters]);

  const cards = [
    ["Total Students", numberValue(data?.academic.total_students)],
    ["Total Teachers", numberValue(data?.academic.total_teachers)],
    ["Classes", numberValue(data?.academic.total_classes)],
    ["Sections", numberValue(data?.academic.total_sections)],
    ["Subjects", numberValue(data?.academic.total_subjects)],
    ["Overall Attendance", percentValue(data?.attendance.overall_percentage)],
    ["Fees Collected", money(data?.fees.total_collected_amount)],
    ["Fees Pending", money(data?.fees.total_pending_amount)],
  ];

  const resultEntries = Object.entries(data?.results || {});
  const filteredClasses = useMemo(() => options.classes.filter((x:any) => !filters.academic_session || String(x.academic_session_id) === filters.academic_session), [options, filters.academic_session]);
  const filteredSections = useMemo(() => options.sections.filter((x:any) => !filters.classroom || String(x.classroom_id) === filters.classroom), [options, filters.classroom]);
  const filteredSubjects = useMemo(() => options.subjects.filter((x:any) => !filters.classroom || String(x.classroom_id) === filters.classroom), [options, filters.classroom]);
  const setFilter = (key:string, value:string) => setFilters((prev:any) => {
    const next = {...prev, [key]: value};
    if (key === "academic_session") { next.classroom=""; next.section=""; next.subject=""; }
    if (key === "classroom") { next.section=""; next.subject=""; }
    return next;
  });
  const reportTable = (headers:string[], rows:any[][]) => (
    <div className="table-responsive"><table className="table table-hover align-middle mb-0">
      <thead className="table-light"><tr>{headers.map(h => <th key={h} className="text-nowrap">{h}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j} className="text-nowrap">{cell}</td>)}</tr>) :
        <tr><td colSpan={headers.length} className="text-center text-muted py-4">No data available for selected filters.</td></tr>}</tbody>
    </table></div>
  );

  const exportCsv = async () => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    try {
      setExportingCsv(true);
      setError("");
      const query = new URLSearchParams(
        Object.entries(appliedFilters).filter(([, value]) => value)
      ).toString();
      const response = await fetch(
        `${API_BASE}/api/reports/college-admin/export/csv/${query ? `?${query}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.detail || "Unable to export CSV report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "college-admin-report.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  const exportExcel = async () => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    try {
      setExportingExcel(true);
      setError("");
      const query = new URLSearchParams(
        Object.entries(appliedFilters).filter(([, value]) => value)
      ).toString();
      const response = await fetch(
        `${API_BASE}/api/reports/college-admin/export/excel/${query ? `?${query}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.detail || "Unable to export Excel report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "college-admin-report.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  const exportPdf = async () => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    try {
      setExportingPdf(true);
      setError("");
      const query = new URLSearchParams(
        Object.entries(appliedFilters).filter(([, value]) => value)
      ).toString();
      const response = await fetch(
        `${API_BASE}/api/reports/college-admin/export/pdf/${query ? `?${query}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.detail || "Unable to export PDF report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "college-admin-report.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  const metricSection = (
    title: string,
    subtitle: string,
    items: [string, string | number][],
  ) => (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="fw-bold mb-1">{title}</h5>
            <p className="text-muted small mb-0">{subtitle}</p>
          </div>
        </div>

        <div className="row g-3">
          {items.map(([label, value]) => (
            <div key={label} className="col-6">
              <div className="border rounded-3 p-3 h-100 bg-light">
                <div className="text-muted small mb-1">{label}</div>
                <div className="fs-5 fw-bold">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">Reports & Analytics</h2>
                <p className="text-muted mb-0">
                  Monitor academic, attendance, financial, and institutional performance.
                </p>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3">Report Filters</h5>
                <div className="row g-3">
                  <div className="col-12 col-md-6 col-xl-2"><label className="form-label">Academic Session</label><select className="form-select" value={filters.academic_session} onChange={e=>setFilter("academic_session",e.target.value)}><option value="">All Sessions</option>{options.academic_sessions.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="col-12 col-md-6 col-xl-2"><label className="form-label">Class</label><select className="form-select" value={filters.classroom} onChange={e=>setFilter("classroom",e.target.value)}><option value="">All Classes</option>{filteredClasses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="col-12 col-md-6 col-xl-2"><label className="form-label">Section</label><select className="form-select" value={filters.section} onChange={e=>setFilter("section",e.target.value)}><option value="">All Sections</option>{filteredSections.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="col-12 col-md-6 col-xl-2"><label className="form-label">Subject</label><select className="form-select" value={filters.subject} onChange={e=>setFilter("subject",e.target.value)}><option value="">All Subjects</option>{filteredSubjects.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="col-6 col-xl-2"><label className="form-label">From</label><input type="date" className="form-control" value={filters.date_from} onChange={e=>setFilter("date_from",e.target.value)}/></div>
                  <div className="col-6 col-xl-2"><label className="form-label">To</label><input type="date" className="form-control" value={filters.date_to} onChange={e=>setFilter("date_to",e.target.value)}/></div>
                </div>
                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button className="btn btn-primary" onClick={()=>setAppliedFilters({...filters})}>Apply Filters</button>
                  <button className="btn btn-outline-secondary" onClick={()=>{const empty={academic_session:"",classroom:"",section:"",subject:"",date_from:"",date_to:""};setFilters(empty);setAppliedFilters(empty)}}>Reset</button>
                  <button className="btn btn-outline-success" onClick={exportCsv} disabled={exportingCsv || loading}>
                    {exportingCsv ? "Exporting CSV..." : "Download CSV"}
                  </button>
                  <button className="btn btn-outline-primary" onClick={exportExcel} disabled={exportingExcel || loading}>
                    {exportingExcel ? "Exporting Excel..." : "Download Excel"}
                  </button>
                  <button className="btn btn-outline-danger" onClick={exportPdf} disabled={exportingPdf || loading}>
                    {exportingPdf ? "Exporting PDF..." : "Download PDF"}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading reports...
                </div>
              </div>
            ) : data ? (
              <>
                <div className="row g-3 mb-4">
                  {cards.map(([label, value]) => (
                    <div key={label} className="col-12 col-sm-6 col-xl-3">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                          <div className="text-muted small mb-2">{label}</div>
                          <div className="fs-4 fw-bold">{value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {details && (
                  <>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-1">Class-wise Performance</h5><p className="text-muted small">Academic, attendance, results and fee position by class.</p>{reportTable(["Class","Session","Students","Sections","Attendance","Assignments","Results","Expected Fees","Collected","Pending"], details.classes.map((x:any)=>[x.name,x.academic_session,x.students,x.sections,percentValue(x.attendance_percentage),x.assignments,x.published_results,money(x.expected_fees),money(x.collected_fees),money(x.pending_fees)]))}</div></div>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-3">Section-wise Attendance</h5>{reportTable(["Class","Section","Students","Attendance"],details.sections.map((x:any)=>[x.class,x.section,x.students,percentValue(x.attendance_percentage)]))}</div></div>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-3">Subject-wise Academic Analytics</h5>{reportTable(["Subject","Attendance","Assignments","Published Results","Average Marks"],details.subjects.map((x:any)=>[x.subject,percentValue(x.attendance_percentage),x.assignments,x.published_results,percentValue(x.average_percentage)]))}</div></div>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-3">Low Attendance Students <span className="badge bg-warning text-dark">&lt; 75%</span></h5>{reportTable(["Student","Roll No.","Class","Section","Present","Absent","Late","Attendance"],details.low_attendance_students.map((x:any)=>[x.student,x.roll_number||"-",x.class,x.section,x.present,x.absent,x.late,percentValue(x.attendance_percentage)]))}</div></div>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-3">Teacher / Live Class Activity</h5>{reportTable(["Teacher","Scheduled","Completed","Cancelled"],details.teacher_activity.map((x:any)=>[x.teacher,x.scheduled,x.completed,x.cancelled]))}</div></div>
                    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h5 className="fw-bold mb-1">Outstanding Fees</h5><p className="text-muted small">Student-level pending fee position.</p>{reportTable(["Student","Roll No.","Class","Section","Expected","Paid","Pending","Status"],details.outstanding_fees.map((x:any)=>[x.student,x.roll_number||"-",x.class||"-",x.section||"-",money(x.expected),money(x.paid),money(x.pending),String(x.status).replaceAll("_"," ")]))}</div></div>
                  </>
                )}

                <div className="row g-4 mb-4">
                  <div className="col-xl-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <h5 className="fw-bold mb-1">Attendance Overview</h5>
                            <p className="text-muted small mb-0">
                              Present and late count toward attendance percentage.
                            </p>
                          </div>
                          <span className="badge bg-primary">
                            {percentValue(data.attendance.overall_percentage)}
                          </span>
                        </div>

                        <div
                          className="progress mb-4"
                          role="progressbar"
                          aria-label="Overall attendance"
                          aria-valuenow={numberValue(data.attendance.overall_percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="progress-bar"
                            style={{
                              width: progressWidth(data.attendance.overall_percentage),
                            }}
                          />
                        </div>

                        <div className="row g-3">
                          {[
                            ["Present", numberValue(data.attendance.present), "bg-success"],
                            ["Absent", numberValue(data.attendance.absent), "bg-danger"],
                            ["Late", numberValue(data.attendance.late), "bg-warning text-dark"],
                            ["Excused", numberValue(data.attendance.excused), "bg-secondary"],
                          ].map(([label, value, className]) => (
                            <div key={label} className="col-6">
                              <div className="d-flex justify-content-between align-items-center border rounded-3 p-3 bg-light">
                                <span className="text-muted small">{label}</span>
                                <span className={`badge ${className}`}>
                                  {value}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-6">
                    {metricSection(
                      "Assignments",
                      "Submission progress across published assignments.",
                      [
                        ["Total Assignments", numberValue(data.assignments.total_assignments)],
                        ["Total Submissions", numberValue(data.assignments.total_submissions)],
                        ["Expected Submissions", numberValue(data.assignments.expected_submissions)],
                        ["Pending Submissions", numberValue(data.assignments.pending_submissions)],
                      ],
                    )}
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-xl-6">
                    {metricSection(
                      "Live Classes",
                      "Scheduled, completed, and cancelled class activity.",
                      [
                        ["Total", numberValue(data.live_classes.total_live_classes)],
                        ["Scheduled", numberValue(data.live_classes.scheduled)],
                        ["Completed", numberValue(data.live_classes.completed)],
                        ["Cancelled", numberValue(data.live_classes.cancelled)],
                      ],
                    )}
                  </div>

                  <div className="col-xl-6">
                    {metricSection(
                      "Fees",
                      "Collection and pending fee position.",
                      [
                        ["Expected", money(data.fees.total_expected_amount)],
                        ["Collected", money(data.fees.total_collected_amount)],
                        ["Pending", money(data.fees.total_pending_amount)],
                        ["Paid Count", numberValue(data.fees.paid_count)],
                        [
                          "Pending / Partial / Overdue",
                          numberValue(data.fees.pending_count),
                        ],
                      ],
                    )}
                  </div>

                  <div className="col-12">
                    <div className="card border-0 shadow-sm">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-1">Results</h5>
                        <p className="text-muted small mb-3">
                          Published result metrics returned by the reports API.
                        </p>

                        {resultEntries.length === 0 ? (
                          <div className="text-center text-muted py-4">
                            No result metrics available.
                          </div>
                        ) : (
                          <div className="row g-3">
                            {resultEntries.map(([label, value]) => (
                              <div key={label} className="col-12 col-sm-6 col-xl-3">
                                <div className="border rounded-3 p-3 bg-light h-100">
                                  <div className="text-muted small mb-1">
                                    {labelize(label)}
                                  </div>
                                  <div className="fs-5 fw-bold">
                                    {value ?? 0}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  No report data available.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
