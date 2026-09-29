"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";
import { useCurrency } from "@/hooks/useCurrency";
import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Fee = {
  id: number;
  payable_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  due_date: string;
  status: string;
  fee_structure: { name: string };
  academic_session: { name: string };
  installments?: { id:number; name:string; amount:string; paid_amount:string; outstanding_amount:string; due_date:string; status:string }[];
  payments?: { id:number; amount:string; payment_date:string; payment_method:string; reference_number:string; installment?: {name:string} | null }[];
};

export default function StudentFeesPage() {
  const router = useRouter();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [student, setStudent] = useState<any>({});
  const { formatCurrency: money } = useCurrency();

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); } catch {}
    if (!token) { router.replace("/student/login"); return; }
    fetch(`${API_BASE}/api/fees/student/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        if (r.status === 401) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return null;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Unable to load fees.");
        return data;
      })
      .then(data => { if (data) setFees(data.student_fees || []); })
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load fees."))
      .finally(() => setLoading(false));
  }, [router]);

  const totals = useMemo(() => fees.reduce((a,f) => ({
    payable: a.payable + Number(f.payable_amount || 0),
    paid: a.paid + Number(f.paid_amount || 0),
    pending: a.pending + Number(f.outstanding_amount || 0),
  }), {payable:0, paid:0, pending:0}), [fees]);

  const label = (v:string) => v.replaceAll("_"," ").replace(/\b\w/g, c => c.toUpperCase());

  const downloadPdf = async (path:string, filename:string) => {
    const token = localStorage.getItem("student_access_token");
    if (!token) { router.replace("/student/login"); return; }
    setError("");
    try {
      const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to download document.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to download document."); }
  };

  return <div className="student-dashboard">
    <StudentSidebar />
    <main className="student-dashboard-main">
      <StudentTopbar name={student.name || student.username || "Student"} organization={student.organization || ""} />
      <div className="student-dashboard-content"><div className="container-fluid">
        {isClassFeatureRestricted(error) ? (
          <StudentFeatureRestricted featureName="Fees" />
        ) : (
          <>
        <div className="dashboard-panel mb-4">
          <div className="panel-heading"><h5>My Fees</h5></div>
          {loading && <div className="empty-state">Loading fees...</div>}
          {error && <div className="alert alert-danger">{error}</div>}
          {!loading && !error && <div className="row g-3">
            {([["Total Payable",totals.payable],["Total Paid",totals.paid],["Total Pending",totals.pending]] as const).map(([k,v]) =>
              <div className="col-md-4" key={k}><div className="border rounded p-3 h-100"><div className="text-muted small">{k}</div><div className="fs-4 fw-bold">{money(v)}</div></div></div>
            )}
          </div>}
        </div>

        {!loading && !error && fees.length === 0 && <div className="dashboard-panel"><div className="empty-state">No fees assigned yet.</div></div>}
        {fees.map(fee => <div className="dashboard-panel mb-4" key={fee.id}>
          <div className="panel-heading"><h5>{fee.fee_structure?.name || "Fee"}</h5><div className="d-flex gap-2 align-items-center"><button className="btn btn-outline-primary btn-sm" onClick={() => downloadPdf(`/api/fees/documents/invoice/${fee.id}/`, `fee-invoice-${fee.id}.pdf`)}>Download Invoice</button><span className="badge bg-light text-dark border">{label(fee.status)}</span></div></div>
          <div className="row g-3 mb-4">
            <div className="col-md-3"><strong>Session</strong><div>{fee.academic_session?.name || "-"}</div></div>
            <div className="col-md-3"><strong>Due Date</strong><div>{fee.due_date}</div></div>
            <div className="col-md-2"><strong>Payable</strong><div>{money(fee.payable_amount)}</div></div>
            <div className="col-md-2"><strong>Paid</strong><div>{money(fee.paid_amount)}</div></div>
            <div className="col-md-2"><strong>Pending</strong><div>{money(fee.outstanding_amount)}</div></div>
          </div>
          <h6>Installments</h6>
          <div className="table-responsive mb-4"><table className="table align-middle"><thead><tr><th>Name</th><th>Amount</th><th>Paid</th><th>Pending</th><th>Due Date</th><th>Status</th></tr></thead>
          <tbody>{fee.installments?.length ? fee.installments.map(i => <tr key={i.id}><td>{i.name}</td><td>{money(i.amount)}</td><td>{money(i.paid_amount)}</td><td>{money(i.outstanding_amount)}</td><td>{i.due_date}</td><td>{label(i.status)}</td></tr>) : <tr><td colSpan={6} className="text-muted">No installments.</td></tr>}</tbody></table></div>
          <h6>Payment History</h6>
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Installment</th><th>Reference</th><th>Receipt</th></tr></thead>
          <tbody>{fee.payments?.length ? fee.payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>{money(p.amount)}</td><td>{label(p.payment_method)}</td><td>{p.installment?.name || "General"}</td><td>{p.reference_number || "-"}</td><td><button className="btn btn-outline-secondary btn-sm" onClick={() => downloadPdf(`/api/fees/documents/receipt/${p.id}/`, `fee-receipt-${p.id}.pdf`)}>Download</button></td></tr>) : <tr><td colSpan={6} className="text-muted">No payments recorded.</td></tr>}</tbody></table></div>
        </div>)}
          </>
        )}
      </div></div>
    </main>
  </div>;
}
