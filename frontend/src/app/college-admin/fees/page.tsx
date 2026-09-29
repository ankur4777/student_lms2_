"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type FeeStatus = "pending" | "partially_paid" | "paid" | "overdue";
interface Admin { username?: string; name?: string; organization?: string; }
interface StudentFee {
  id:number; student:{name:string; admission_number:string}; academic_session:{id:number;name:string};
  fee_structure:{id:number;name:string}; enrollment:null|{roll_number:string;class_room:string;section:string};
  payable_amount:string; paid_amount:string; outstanding_amount:string; due_date:string; status:FeeStatus;
}
function savedAdmin():Admin { if(typeof window==="undefined") return {}; try{return JSON.parse(localStorage.getItem("college_admin_user")||"{}")}catch{return {}} }
const money=(v:string|number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2}).format(Number(v||0));
const badge=(s:FeeStatus)=>s==="paid"?"bg-success":s==="overdue"?"bg-danger":s==="partially_paid"?"bg-info text-dark":"bg-warning text-dark";

export default function FeesPage(){
 const router=useRouter(); const [admin]=useState<Admin>(savedAdmin); const [fees,setFees]=useState<StudentFee[]>([]);
 const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [search,setSearch]=useState(""); const [status,setStatus]=useState("");
 const clear=useCallback(()=>{["college_admin_access_token","college_admin_refresh_token","college_admin_user"].forEach(k=>localStorage.removeItem(k));},[]);
 const load=useCallback(async()=>{const token=localStorage.getItem("college_admin_access_token"); if(!token){router.replace("/college-admin/login");return}
  setLoading(true);setError("");try{const r=await fetch(`${API_BASE}/api/fees/college-admin/student-fees/`,{headers:{Authorization:`Bearer ${token}`}});
  if(r.status===401){clear();router.replace("/college-admin/login");return} const j=await r.json(); if(!r.ok) throw new Error(j.detail||"Unable to load fees."); setFees(j.student_fees||[])}
  catch(e){setError(e instanceof Error?e.message:"Unable to load fees.")}finally{setLoading(false)}},[clear,router]);
 useEffect(()=>{void load()},[load]);
 const visible=useMemo(()=>fees.filter(f=>{const q=search.trim().toLowerCase(); const hit=!q||f.student.name.toLowerCase().includes(q)||f.student.admission_number?.toLowerCase().includes(q)||f.enrollment?.roll_number?.toLowerCase().includes(q); return hit&&(!status||f.status===status)}),[fees,search,status]);
 const totals=useMemo(()=>fees.reduce((a,f)=>{a.payable+=Number(f.payable_amount);a.paid+=Number(f.paid_amount);a.pending+=Number(f.outstanding_amount);if(f.status==="overdue")a.overdue+=Number(f.outstanding_amount);return a},{payable:0,paid:0,pending:0,overdue:0}),[fees]);
 return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main"><CollegeAdminTopbar name={admin.name||admin.username||"College Admin"} organization={admin.organization||""}/>
 <div className="teacher-dashboard-content"><div className="container-fluid">
  <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4"><div><h2 className="fw-bold mb-1">Fees Management</h2><p className="text-muted mb-0">Track assigned fees, collections and outstanding balances.</p></div>
   <div className="d-flex gap-2 flex-wrap"><Link href="/college-admin/fees/structures" className="btn btn-outline-primary">Fee Structures</Link><Link href="/college-admin/fees/assign" className="btn btn-primary">Assign Fee</Link></div></div>
  {error&&<div className="alert alert-danger">{error}</div>}
  <div className="row g-3 mb-4">{[["Total Payable",totals.payable],["Total Collected",totals.paid],["Total Pending",totals.pending],["Overdue Amount",totals.overdue]].map(([l,v])=><div className="col-12 col-sm-6 col-xl-3" key={String(l)}><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small mb-2">{l}</div><h4 className="fw-bold mb-0">{money(Number(v))}</h4></div></div></div>)}</div>
  <div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-2"><div className="col-md-8"><input className="form-control" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, admission or roll number"/></div><div className="col-md-4"><select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="partially_paid">Partially Paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div></div></div></div>
  {loading?<div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted">Loading fees...</div></div>:visible.length===0?<div className="card border-0 shadow-sm"><div className="card-body py-5 text-center"><h5 className="fw-bold">No Student Fees</h5><p className="text-muted mb-3">Assigned student fees will appear here.</p><Link href="/college-admin/fees/assign" className="btn btn-primary">Assign First Fee</Link></div></div>:
  <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Student</th><th>Class / Section</th><th>Session</th><th>Fee Structure</th><th>Payable</th><th>Paid</th><th>Pending</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(f=><tr key={f.id}><td><div className="fw-semibold">{f.student.name}</div><small className="text-muted">{f.enrollment?.roll_number||f.student.admission_number||"-"}</small></td><td>{f.enrollment?`${f.enrollment.class_room} / ${f.enrollment.section}`:"-"}</td><td>{f.academic_session.name}</td><td>{f.fee_structure.name}</td><td>{money(f.payable_amount)}</td><td>{money(f.paid_amount)}</td><td>{money(f.outstanding_amount)}</td><td>{f.due_date||"-"}</td><td><span className={`badge ${badge(f.status)}`}>{f.status.replace("_"," ")}</span></td><td><Link className="btn btn-outline-primary btn-sm" href={`/college-admin/fees/student-fees/${f.id}`}>View</Link></td></tr>)}</tbody></table></div></div>}
 </div></div></main></div>
}