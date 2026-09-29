"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../../teacher/dashboard/dashboard.css";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL;
interface Admin{username?:string;name?:string;organization?:string}
interface Structure{id:number;name:string;description:string;total_amount:string;due_date:string|null;is_active:boolean;academic_session:{name:string};class_room:{name:string}}
function admin():Admin{if(typeof window==="undefined")return{};try{return JSON.parse(localStorage.getItem("college_admin_user")||"{}")}catch{return{}}}
const money=(v:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(v||0));

export default function FeeStructuresPage(){
 const router=useRouter(),[user]=useState<Admin>(admin),[items,setItems]=useState<Structure[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{const token=localStorage.getItem("college_admin_access_token");if(!token){router.replace("/college-admin/login");return}
  try{const r=await fetch(`${API_BASE}/api/fees/college-admin/structures/`,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();if(r.status===401){router.replace("/college-admin/login");return}if(!r.ok)throw new Error(j.detail||"Unable to load fee structures.");setItems(j.structures||[])}
  catch(e){setError(e instanceof Error?e.message:"Unable to load fee structures.")}finally{setLoading(false)}},[router]);
 useEffect(()=>{void load()},[load]);
 return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main"><CollegeAdminTopbar name={user.name||user.username||"College Admin"} organization={user.organization||""}/><div className="teacher-dashboard-content"><div className="container-fluid">
 <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4"><div><h2 className="fw-bold mb-1">Fee Structures</h2><p className="text-muted mb-0">Define fee amounts and components for each class and academic session.</p></div><div className="d-flex gap-2"><Link href="/college-admin/fees" className="btn btn-outline-secondary">Back to Fees</Link><Link href="/college-admin/fees/structures/create" className="btn btn-primary">Create Fee Structure</Link></div></div>
 {error&&<div className="alert alert-danger">{error}</div>}
 {loading?<div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted">Loading fee structures...</div></div>:items.length===0?<div className="card border-0 shadow-sm"><div className="card-body py-5 text-center"><h5 className="fw-bold">No Fee Structures</h5><p className="text-muted">Create a fee structure before assigning fees to students.</p><Link href="/college-admin/fees/structures/create" className="btn btn-primary">Create First Structure</Link></div></div>:<div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Name</th><th>Session</th><th>Class</th><th>Total</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><div className="fw-semibold">{x.name}</div><small className="text-muted">{x.description||"-"}</small></td><td>{x.academic_session.name}</td><td>{x.class_room.name}</td><td>{money(x.total_amount)}</td><td>{x.due_date||"-"}</td><td><span className={`badge ${x.is_active?"bg-success":"bg-secondary"}`}>{x.is_active?"Active":"Inactive"}</span></td><td><Link className="btn btn-outline-primary btn-sm" href={`/college-admin/fees/structures/${x.id}/edit`}>Edit</Link></td></tr>)}</tbody></table></div></div>}
 </div></div></main></div>
}