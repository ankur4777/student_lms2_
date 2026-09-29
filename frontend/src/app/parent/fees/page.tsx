"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import ParentFeatureRestricted, { isParentClassFeatureRestricted } from "@/components/parent/ParentFeatureRestricted";
import { useCurrency } from "@/hooks/useCurrency";
import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Child = { student_profile_id:number; name:string; username:string; roll_number:string; classroom_name:string; section_name:string };
type Fee = {
  id:number; payable_amount:string; paid_amount:string; outstanding_amount:string; due_date:string; status:string;
  fee_structure:{name:string}; academic_session:{name:string};
  installments?: {id:number;name:string;amount:string;paid_amount:string;outstanding_amount:string;due_date:string;status:string}[];
  payments?: {id:number;amount:string;payment_date:string;payment_method:string;reference_number:string;installment?:{name:string}|null}[];
};

export default function ParentFeesPage() {
  const router=useRouter();
  const [parent,setParent]=useState<any>({});
  const [children,setChildren]=useState<Child[]>([]);
  const [selected,setSelected]=useState("");
  const [fees,setFees]=useState<Fee[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const { formatCurrency: money } = useCurrency();

  const clearSession=()=>{localStorage.removeItem("parent_access_token");localStorage.removeItem("parent_refresh_token");localStorage.removeItem("parent_user");};
  const label=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

  const downloadPdf=async(path:string,filename:string)=>{
    const token=localStorage.getItem("parent_access_token");
    if(!token){router.replace("/parent/login");return;}
    setError("");
    try{
      const r=await fetch(`${API_BASE}${path}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.detail||"Unable to download document.");}
      const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");
      a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Unable to download document.");}
  };

  const loadFees=async(token:string,id:string)=>{
    setLoading(true); setError("");
    try {
      const r=await fetch(`${API_BASE}/api/fees/parent/student/${id}/`,{headers:{Authorization:`Bearer ${token}`}});
      if(r.status===401){clearSession();router.replace("/parent/login");return;}
      const data=await r.json(); if(!r.ok) throw new Error(data.detail||"Unable to load fees.");
      setFees(data.student_fees||[]);
    } catch(e){setFees([]);setError(e instanceof Error?e.message:"Unable to load fees.");}
    finally{setLoading(false);}
  };

  useEffect(()=>{
    const token=localStorage.getItem("parent_access_token");
    if(!token){router.replace("/parent/login");return;}
    try{setParent(JSON.parse(localStorage.getItem("parent_user")||"{}"));}catch{}
    (async()=>{
      try{
        const r=await fetch(`${API_BASE}/api/accounts/parent/children/`,{headers:{Authorization:`Bearer ${token}`}});
        if(r.status===401){clearSession();router.replace("/parent/login");return;}
        const data=await r.json(); if(!r.ok) throw new Error(data.detail||"Unable to load children.");
        const list=data.children||[]; setChildren(list);
        if(list.length){const id=String(list[0].student_profile_id);setSelected(id);await loadFees(token,id);} else setLoading(false);
      }catch(e){setError(e instanceof Error?e.message:"Unable to load children.");setLoading(false);}
    })();
  },[router]);

  const totals=useMemo(()=>fees.reduce((a,f)=>({payable:a.payable+Number(f.payable_amount||0),paid:a.paid+Number(f.paid_amount||0),pending:a.pending+Number(f.outstanding_amount||0)}),{payable:0,paid:0,pending:0}),[fees]);
  const selectedChild=children.find(c=>String(c.student_profile_id)===selected);
  const featureRestricted=isParentClassFeatureRestricted(error);

  const changeChild=async(id:string)=>{setSelected(id);setFees([]);const token=localStorage.getItem("parent_access_token");if(token&&id)await loadFees(token,id);};

  return <div className="student-dashboard"><ParentSidebar/><main className="student-dashboard-main">
    <ParentTopbar name={parent.name||parent.username||"Parent"} organization={parent.organization||""}/>
    <div className="student-dashboard-content"><div className="container-fluid">
      <div className="dashboard-panel mb-4">
        <div className="panel-heading"><h5>Child Fees</h5></div>
        <div className="row g-3 align-items-end">
          <div className="col-md-5"><label className="form-label">Select Child</label><select className="form-select" value={selected} onChange={e=>changeChild(e.target.value)} disabled={!children.length}>
            {!children.length&&<option value="">No linked children</option>}
            {children.map(c=><option key={c.student_profile_id} value={c.student_profile_id}>{c.name} - {c.classroom_name} / {c.section_name}</option>)}
          </select></div>
        </div>
        {error&&!featureRestricted&&<div className="alert alert-danger mt-3">{error}</div>}
        {loading&&<div className="empty-state">Loading fees...</div>}
        {!loading&&!error&&selected&&<div className="row g-3 mt-2">
          {([["Total Payable",totals.payable],["Total Paid",totals.paid],["Total Pending",totals.pending]] as const).map(([k,v])=><div className="col-md-4" key={k}><div className="border rounded p-3 h-100"><div className="text-muted small">{k}</div><div className="fs-4 fw-bold">{money(v)}</div></div></div>)}
        </div>}
      </div>

      {featureRestricted&&<ParentFeatureRestricted featureName="Fees" childName={selectedChild?.name} />}

      {!loading&&!error&&selected&&fees.length===0&&<div className="dashboard-panel"><div className="empty-state">No fees assigned to this child.</div></div>}
      {fees.map(f=><div className="dashboard-panel mb-4" key={f.id}>
        <div className="panel-heading"><h5>{f.fee_structure?.name||"Fee"}</h5><div className="d-flex gap-2 align-items-center"><button className="btn btn-outline-primary btn-sm" onClick={()=>downloadPdf(`/api/fees/documents/invoice/${f.id}/`,`fee-invoice-${f.id}.pdf`)}>Download Invoice</button><span className="badge bg-light text-dark border">{label(f.status)}</span></div></div>
        <div className="row g-3 mb-4">
          <div className="col-md-3"><strong>Session</strong><div>{f.academic_session?.name||"-"}</div></div>
          <div className="col-md-3"><strong>Due Date</strong><div>{f.due_date}</div></div>
          <div className="col-md-2"><strong>Payable</strong><div>{money(f.payable_amount)}</div></div>
          <div className="col-md-2"><strong>Paid</strong><div>{money(f.paid_amount)}</div></div>
          <div className="col-md-2"><strong>Pending</strong><div>{money(f.outstanding_amount)}</div></div>
        </div>
        <h6>Installments</h6><div className="table-responsive mb-4"><table className="table align-middle"><thead><tr><th>Name</th><th>Amount</th><th>Paid</th><th>Pending</th><th>Due Date</th><th>Status</th></tr></thead><tbody>
          {f.installments?.length?f.installments.map(i=><tr key={i.id}><td>{i.name}</td><td>{money(i.amount)}</td><td>{money(i.paid_amount)}</td><td>{money(i.outstanding_amount)}</td><td>{i.due_date}</td><td>{label(i.status)}</td></tr>):<tr><td colSpan={6} className="text-muted">No installments.</td></tr>}
        </tbody></table></div>
        <h6>Payment History</h6><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Installment</th><th>Reference</th><th>Receipt</th></tr></thead><tbody>
          {f.payments?.length?f.payments.map(p=><tr key={p.id}><td>{p.payment_date}</td><td>{money(p.amount)}</td><td>{label(p.payment_method)}</td><td>{p.installment?.name||"General"}</td><td>{p.reference_number||"-"}</td><td><button className="btn btn-outline-secondary btn-sm" onClick={()=>downloadPdf(`/api/fees/documents/receipt/${p.id}/`,`fee-receipt-${p.id}.pdf`)}>Download</button></td></tr>):<tr><td colSpan={6} className="text-muted">No payments recorded.</td></tr>}
        </tbody></table></div>
      </div>)}
    </div></div>
  </main></div>;
}
