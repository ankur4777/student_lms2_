"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const money = (value: string | number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

export default function StudentFeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [fee, setFee] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [installment, setInstallment] = useState({ name: "", amount: "", due_date: "", sequence: "1" });
  const [payment, setPayment] = useState({ amount: "", payment_date: new Date().toISOString().slice(0,10), payment_method: "cash", installment_id: "", reference_number: "", notes: "" });
  const [admin] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("college_admin_user") || "{}"); } catch { return {}; } });

  const load = useCallback(async () => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) { router.replace("/college-admin/login"); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/fees/college-admin/student-fees/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load fee.");
      setFee(data.student_fee);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load fee."); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  async function submit(path: string, body: object) {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) return;
    setError("");
    const response = await fetch(`${API_BASE}/api/fees/college-admin/student-fees/${id}/${path}/`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) { setError(`Server returned error ${response.status}.`); return; }
    const data = await response.json();
    if (!response.ok) { setError(data.detail || Object.values(data).join(", ") || "Request failed."); return; }
    await load();
  }

  const downloadPdf = async (path: string, filename: string) => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) { router.replace("/college-admin/login"); return; }
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

  const addInstallment = async (e: FormEvent) => {
    e.preventDefault();
    await submit("installments", { ...installment, sequence: Number(installment.sequence) });
    setInstallment({ name: "", amount: "", due_date: "", sequence: String((fee?.installments?.length || 0) + 2) });
  };
  const addPayment = async (e: FormEvent) => {
    e.preventDefault();
    await submit("payments", { ...payment, installment_id: payment.installment_id ? Number(payment.installment_id) : null });
    setPayment({ ...payment, amount: "", installment_id: "", reference_number: "", notes: "" });
  };

  if (loading) return <div className="p-5 text-center">Loading fee details...</div>;

  return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main">
    <CollegeAdminTopbar name={admin.name || admin.username || "College Admin"} organization={admin.organization || ""}/>
    <div className="teacher-dashboard-content"><div className="container-fluid">
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-4"><div><h2 className="fw-bold">Student Fee Detail</h2><p className="text-muted mb-0">{fee?.student?.name} • {fee?.enrollment?.class_room} / {fee?.enrollment?.section}</p></div><div className="d-flex gap-2"><button className="btn btn-outline-primary" onClick={() => downloadPdf(`/api/fees/documents/invoice/${id}/`, `fee-invoice-${id}.pdf`)}>Download Invoice</button><button className="btn btn-outline-secondary" onClick={() => router.push("/college-admin/fees")}>Back to Fees</button></div></div>
      {error && <div className="alert alert-danger">{error}</div>}
      {fee && <>
        <div className="row g-3 mb-4">{[["Original",fee.original_amount],["Discount",fee.discount_amount],["Fine",fee.fine_amount],["Payable",fee.payable_amount],["Paid",fee.paid_amount],["Pending",fee.outstanding_amount]].map(([label,value]) => <div className="col-6 col-md-4 col-xl-2" key={label}><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-muted">{label}</small><div className="fw-bold fs-5">{money(value)}</div></div></div></div>)}</div>

        <div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3"><div className="col-md-4"><b>Fee Structure</b><div>{fee.fee_structure?.name}</div></div><div className="col-md-3"><b>Session</b><div>{fee.academic_session?.name}</div></div><div className="col-md-3"><b>Due Date</b><div>{fee.due_date}</div></div><div className="col-md-2"><b>Status</b><div className="text-capitalize">{String(fee.status).replace("_"," ")}</div></div></div></div></div>

        <h4 className="fw-bold">Installments</h4>
        <div className="card border-0 shadow-sm mb-3"><div className="card-body"><form onSubmit={addInstallment} className="row g-2">
          <div className="col-md-3"><input className="form-control" placeholder="Installment name" value={installment.name} onChange={e=>setInstallment({...installment,name:e.target.value})} required/></div>
          <div className="col-md-3"><input type="number" min="0.01" step="0.01" className="form-control" placeholder="Amount" value={installment.amount} onChange={e=>setInstallment({...installment,amount:e.target.value})} required/></div>
          <div className="col-md-3"><input type="date" className="form-control" value={installment.due_date} onChange={e=>setInstallment({...installment,due_date:e.target.value})} required/></div>
          <div className="col-md-1"><input type="number" min="1" className="form-control" value={installment.sequence} onChange={e=>setInstallment({...installment,sequence:e.target.value})}/></div>
          <div className="col-md-2 d-grid"><button className="btn btn-outline-primary">Add</button></div>
        </form></div></div>
        <div className="card border-0 shadow-sm mb-4"><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Name</th><th>Amount</th><th>Paid</th><th>Pending</th><th>Due</th><th>Status</th></tr></thead><tbody>{fee.installments?.length ? fee.installments.map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{money(x.amount)}</td><td>{money(x.paid_amount)}</td><td>{money(x.outstanding_amount)}</td><td>{x.due_date}</td><td className="text-capitalize">{x.status}</td></tr>) : <tr><td colSpan={6} className="text-center text-muted py-3">No installments added.</td></tr>}</tbody></table></div></div>

        <h4 className="fw-bold">Record Payment</h4>
        <div className="card border-0 shadow-sm mb-3"><div className="card-body"><form onSubmit={addPayment} className="row g-2">
          <div className="col-md-2"><input type="number" min="0.01" step="0.01" max={fee.outstanding_amount} className="form-control" placeholder="Amount" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} required/></div>
          <div className="col-md-2"><input type="date" className="form-control" value={payment.payment_date} onChange={e=>setPayment({...payment,payment_date:e.target.value})} required/></div>
          <div className="col-md-2"><select className="form-select" value={payment.payment_method} onChange={e=>setPayment({...payment,payment_method:e.target.value})}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></div>
          <div className="col-md-2"><select className="form-select" value={payment.installment_id} onChange={e=>setPayment({...payment,installment_id:e.target.value})}><option value="">General payment</option>{fee.installments?.filter((x:any)=>Number(x.outstanding_amount)>0).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="col-md-2"><input className="form-control" placeholder="Reference" value={payment.reference_number} onChange={e=>setPayment({...payment,reference_number:e.target.value})}/></div>
          <div className="col-md-2 d-grid"><button className="btn btn-primary">Record</button></div>
        </form></div></div>

        <h4 className="fw-bold">Payment History</h4>
        <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Installment</th><th>Reference</th><th>Recorded By</th><th>Receipt</th></tr></thead><tbody>{fee.payments?.length ? fee.payments.map((p:any)=><tr key={p.id}><td>{p.payment_date}</td><td>{money(p.amount)}</td><td className="text-capitalize">{String(p.payment_method).replace("_"," ")}</td><td>{p.installment?.name || "-"}</td><td>{p.reference_number || "-"}</td><td>{p.recorded_by}</td><td><button className="btn btn-outline-secondary btn-sm" onClick={() => downloadPdf(`/api/fees/documents/receipt/${p.id}/`, `fee-receipt-${p.id}.pdf`)}>Download</button></td></tr>) : <tr><td colSpan={7} className="text-center text-muted py-3">No payments recorded.</td></tr>}</tbody></table></div></div>
      </>}
    </div></div>
  </main></div>;
}