"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type AssignMode = "individual" | "class";

interface Admin {
  username?: string;
  name?: string;
  organization?: string;
}

interface AcademicSession {
  id: number;
  name: string;
}

interface ClassRoom {
  id: number;
  name: string;
  academic_session_id: number;
}

interface Section {
  id: number;
  name: string;
  class_room_id: number;
}

interface Student {
  student_profile_id: number;
  name: string;
  username: string;
  admission_number: string;
  enrollment_id: number;
  class_room_id: number;
}

interface Enrollment {
  id: number;
  roll_number: string;
}

interface Structure {
  id: number;
  name: string;
  total_amount: string;
  due_date: string | null;
  academic_session: { id: number; name: string };
  class_room: { id: number; name: string };
}

interface PreviewStudent {
  enrollment_id: number;
  roll_number: string;
  name: string;
  admission_number: string;
  username: string;
  class_room_name: string;
  section_name: string;
  status: string;
}

interface PreviewData {
  eligible_students: number;
  students: PreviewStudent[];
}

function savedAdmin(): Admin {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("college_admin_user") || "{}");
  } catch {
    return {};
  }
}

function money(value: string | number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function AssignFeePage() {
  const router = useRouter();
  const [admin] = useState<Admin>(savedAdmin);
  const [mode, setMode] = useState<AssignMode>("individual");
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [studentId, setStudentId] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [fine, setFine] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tokenOrRedirect = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
    }
    return token;
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function loadSetup() {
      const token = tokenOrRedirect();
      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/fees/college-admin/setup/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();

        if (response.status === 401) {
          router.replace("/college-admin/login");
          return;
        }

        if (!response.ok) {
          throw new Error(result.detail || "Unable to load fee setup.");
        }

        if (mounted) {
          setSessions(result.academic_sessions || []);
          setClasses(result.classes || []);
          setSections(result.sections || []);
          setStudents(result.students || []);
          setEnrollments(result.enrollments || []);
          setStructures(result.fee_structures || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load fee setup.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSetup();
    return () => {
      mounted = false;
    };
  }, [router, tokenOrRedirect]);

  const student = useMemo(
    () => students.find((item) => String(item.student_profile_id) === studentId),
    [studentId, students],
  );
  const enrollment = useMemo(
    () => student ? enrollments.find((item) => item.id === student.enrollment_id) : undefined,
    [enrollments, student],
  );
  const sessionClasses = useMemo(
    () => classes.filter((item) => !academicSessionId || String(item.academic_session_id) === academicSessionId),
    [academicSessionId, classes],
  );
  const classSections = useMemo(
    () => sections.filter((item) => String(item.class_room_id) === classroomId),
    [classroomId, sections],
  );
  const compatibleStructures = useMemo(() => {
    if (mode === "individual") {
      return structures.filter((item) => !student || item.class_room.id === student.class_room_id);
    }

    return structures.filter((item) => (
      (!academicSessionId || String(item.academic_session.id) === academicSessionId) &&
      (!classroomId || String(item.class_room.id) === classroomId)
    ));
  }, [academicSessionId, classroomId, mode, structures, student]);
  const structure = useMemo(
    () => structures.find((item) => String(item.id) === structureId),
    [structureId, structures],
  );
  const payable = Math.max(
    0,
    Number(structure?.total_amount || 0) - Number(discount || 0) + Number(fine || 0),
  );

  const resetFeeDetails = () => {
    setStructureId("");
    setDueDate("");
    setDiscount("0");
    setFine("0");
    setSuccess("");
    setError("");
  };

  const chooseStructure = (id: string) => {
    setStructureId(id);
    const selected = structures.find((item) => String(item.id) === id);
    setDueDate(selected?.due_date || "");
  };

  useEffect(() => {
    let mounted = true;

    async function loadPreview() {
      if (mode !== "class" || !academicSessionId || !classroomId) {
        setPreview(null);
        return;
      }

      const token = tokenOrRedirect();
      if (!token) {
        return;
      }

      setPreviewLoading(true);
      try {
        const params = new URLSearchParams({
          academic_session_id: academicSessionId,
          classroom_id: classroomId,
        });
        if (sectionId) {
          params.set("section_id", sectionId);
        }

        const response = await fetch(
          `${API_BASE}/api/fees/college-admin/class-students/?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || "Unable to load eligible students.");
        }

        if (mounted) {
          setPreview({
            eligible_students: result.eligible_students || 0,
            students: result.students || [],
          });
        }
      } catch (err) {
        if (mounted) {
          setPreview(null);
          setError(err instanceof Error ? err.message : "Unable to load eligible students.");
        }
      } finally {
        if (mounted) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      mounted = false;
    };
  }, [academicSessionId, classroomId, mode, sectionId, tokenOrRedirect]);

  async function submitIndividual(event: FormEvent) {
    event.preventDefault();
    if (!student || !enrollment || !structure) {
      return;
    }

    const token = tokenOrRedirect();
    if (!token) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/fees/college-admin/student-fees/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_profile_id: student.student_profile_id,
          enrollment_id: enrollment.id,
          academic_session_id: structure.academic_session.id,
          fee_structure_id: structure.id,
          discount_amount: Number(discount || 0).toFixed(2),
          fine_amount: Number(fine || 0).toFixed(2),
          due_date: dueDate,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        const message = result.detail || result.discount_amount || result.fine_amount || "Unable to assign fee.";
        throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
      }

      router.replace("/college-admin/fees");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign fee.");
    } finally {
      setSaving(false);
    }
  }

  async function submitClass() {
    if (!structure || !academicSessionId || !classroomId) {
      return;
    }

    const token = tokenOrRedirect();
    if (!token) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/api/fees/college-admin/assign-class/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academic_session_id: academicSessionId,
          classroom_id: classroomId,
          section_id: sectionId,
          fee_structure_id: structure.id,
          discount_amount: Number(discount || 0).toFixed(2),
          fine_amount: Number(fine || 0).toFixed(2),
          due_date: dueDate,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Unable to assign fees to class.");
      }

      setSuccess(result.message || "Fees assigned successfully.");
      setConfirming(false);
      await refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign fees to class.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshPreview() {
    if (!academicSessionId || !classroomId) {
      return;
    }
    const token = tokenOrRedirect();
    if (!token) {
      return;
    }
    const params = new URLSearchParams({
      academic_session_id: academicSessionId,
      classroom_id: classroomId,
    });
    if (sectionId) {
      params.set("section_id", sectionId);
    }
    const response = await fetch(
      `${API_BASE}/api/fees/college-admin/class-students/?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.ok) {
      const result = await response.json();
      setPreview({
        eligible_students: result.eligible_students || 0,
        students: result.students || [],
      });
    }
  }

  const feeFields = (
    <>
      <div className="col-md-6">
        <label className="form-label">Fee Structure</label>
        <select
          className="form-select"
          value={structureId}
          onChange={(event) => chooseStructure(event.target.value)}
          disabled={mode === "individual" ? !studentId : !classroomId}
          required
        >
          <option value="">Select fee structure</option>
          {compatibleStructures.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - {money(item.total_amount)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label">Original Amount</label>
        <input className="form-control" value={structure ? money(structure.total_amount) : money(0)} disabled />
      </div>
      <div className="col-md-3">
        <label className="form-label">Payable</label>
        <input className="form-control fw-bold" value={money(payable)} disabled />
      </div>
      <div className="col-md-4">
        <label className="form-label">Discount</label>
        <input type="number" min="0" step="0.01" className="form-control" value={discount} onChange={(event) => setDiscount(event.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Fine</label>
        <input type="number" min="0" step="0.01" className="form-control" value={fine} onChange={(event) => setFine(event.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Due Date</label>
        <input type="date" className="form-control" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
      </div>
    </>
  );

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar name={admin.name || admin.username || "College Admin"} organization={admin.organization || ""} />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Assign Fees</h2>
              <p className="text-muted mb-0">
                Assign fee structures to an individual student or an entire class.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">Loading fee setup...</div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <div className="mb-4">
                    <label className="form-label d-block">Assign Fees To</label>
                    <div className="btn-group flex-wrap" role="group">
                      <button type="button" className={`btn ${mode === "individual" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setMode("individual"); resetFeeDetails(); }}>
                        Individual Student
                      </button>
                      <button type="button" className={`btn ${mode === "class" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setMode("class"); setStudentId(""); resetFeeDetails(); }}>
                        Whole Class
                      </button>
                    </div>
                  </div>

                  {mode === "individual" ? (
                    <form onSubmit={submitIndividual}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Student</label>
                          <select className="form-select" value={studentId} onChange={(event) => { setStudentId(event.target.value); resetFeeDetails(); }} required>
                            <option value="">Select student</option>
                            {students.map((item) => (
                              <option key={item.student_profile_id} value={item.student_profile_id}>
                                {item.name} - {item.admission_number || item.username}
                              </option>
                            ))}
                          </select>
                          {enrollment && <small className="text-muted">Roll number: {enrollment.roll_number || "-"}</small>}
                        </div>
                        {feeFields}
                        <div className="col-12 d-flex flex-wrap gap-2">
                          <button className="btn btn-primary" disabled={saving || !student || !structure}>
                            {saving ? "Assigning..." : "Assign Fee"}
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => router.push("/college-admin/fees")}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">Academic Session</label>
                          <select className="form-select" value={academicSessionId} onChange={(event) => { setAcademicSessionId(event.target.value); setClassroomId(""); setSectionId(""); resetFeeDetails(); }} required>
                            <option value="">Select academic session</option>
                            {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Class</label>
                          <select className="form-select" value={classroomId} onChange={(event) => { setClassroomId(event.target.value); setSectionId(""); resetFeeDetails(); }} disabled={!academicSessionId} required>
                            <option value="">Select class</option>
                            {sessionClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Section</label>
                          <select className="form-select" value={sectionId} onChange={(event) => setSectionId(event.target.value)} disabled={!classroomId}>
                            <option value="">All Sections</option>
                            {classSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>

                        <div className="col-12">
                          <div className="card border-0 bg-light">
                            <div className="card-body">
                              <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                                <h5 className="fw-bold mb-0">Student Preview</h5>
                                <span className="badge bg-primary">Students Found: {preview?.eligible_students ?? 0}</span>
                              </div>
                              {previewLoading ? (
                                <div className="text-center text-muted py-4">Loading students...</div>
                              ) : !preview || preview.students.length === 0 ? (
                                <div className="text-center text-muted py-4">Select a class to preview eligible active enrollments.</div>
                              ) : (
                                <div className="table-responsive">
                                  <table className="table align-middle mb-0">
                                    <thead>
                                      <tr>
                                        <th>Roll No.</th>
                                        <th>Student</th>
                                        <th>Class</th>
                                        <th>Section</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {preview.students.map((item) => (
                                        <tr key={item.enrollment_id}>
                                          <td>{item.roll_number || "-"}</td>
                                          <td>
                                            <div className="fw-semibold">{item.name}</div>
                                            <small className="text-muted">{item.admission_number || item.username}</small>
                                          </td>
                                          <td>{item.class_room_name}</td>
                                          <td>{item.section_name}</td>
                                          <td><span className="badge bg-success">{item.status}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {feeFields}

                        <div className="col-12 d-flex flex-wrap gap-2">
                          <button className="btn btn-primary" disabled={saving || !structure || !preview || preview.eligible_students === 0}>
                            Assign Fees to Class
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => router.push("/college-admin/fees")}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="mt-4 pt-3 border-top">
                    <ProductCredit />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {confirming && structure && (
        <div className="modal d-block" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Class Fee Assignment</h5>
                <button type="button" className="btn-close" onClick={() => setConfirming(false)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <p className="mb-2">
                  You are about to assign <strong>{money(payable)}</strong> to <strong>{preview?.eligible_students ?? 0}</strong> students.
                </p>
                <p className="text-muted mb-0">
                  This will create individual fee obligations for eligible students only. Existing duplicate assignments will be skipped.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirming(false)} disabled={saving}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={submitClass} disabled={saving}>
                  {saving ? "Assigning..." : "Confirm & Assign"}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </div>
      )}
    </div>
  );
}
