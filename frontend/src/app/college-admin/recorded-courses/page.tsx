"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
type Course={id:number;title:string;description:string;price:string;access_duration_days:number;is_active:boolean;lesson_count:number};
export default function RecordedCoursesPage(){
 const router=useRouter(); const [courses,setCourses]=useState<Course[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const [form,setForm]=useState({title:"",description:"",price:"",access_duration_days:"180",is_active:true});
 const [admin]=useState<any>(()=>{try{return JSON.parse(localStorage.getItem("college_admin_user")||"{}")}catch{return {}}});
 const load=useCallback(async()=>{const token=localStorage.getItem("college_admin_access_token");if(!token){router.replace("/college-admin/login");return}
  setLoading(true);try{const r=await fetch(`${API_BASE}/api/recorded-courses/college-admin/courses/`,{headers:{Authorization:`Bearer ${token}`}});const j=await r.json();if(!r.ok)throw new Error(j.detail||"Unable to load recorded courses.");setCourses(j.courses||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load recorded courses.")}finally{setLoading(false)}},[router]);
 useEffect(()=>{void load()},[load]);
 async function create(e:FormEvent){e.preventDefault();const token=localStorage.getItem("college_admin_access_token");if(!token)return;setError("");
  const r=await fetch(`${API_BASE}/api/recorded-courses/college-admin/courses/`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({...form,access_duration_days:Number(form.access_duration_days)})});
  const j=await r.json();if(!r.ok){setError(j.detail||Object.values(j).join(", "));return}setForm({title:"",description:"",price:"",access_duration_days:"180",is_active:true});await load();}
 const money=(v:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(v));
 return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main"><CollegeAdminTopbar name={admin.name||admin.username||"College Admin"} organization={admin.organization||""}/>
 <div className="teacher-dashboard-content"><div className="container-fluid"><div className="mb-4"><h2 className="fw-bold mb-1">Recorded Courses</h2><p className="text-muted mb-0">Create paid recorded courses and manage their lessons.</p></div>
 {error&&<div className="alert alert-danger">{error}</div>}
 <div className="card border-0 shadow-sm mb-4"><div className="card-body"><h5 className="fw-bold mb-3">Create Recorded Course</h5><form onSubmit={create}><div className="row g-3">
 <div className="col-md-6"><label className="form-label">Course Title</label><input required className="form-control" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
 <div className="col-md-3"><label className="form-label">Price (₹)</label><input required min="0" step="0.01" type="number" className="form-control" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
 <div className="col-md-3"><label className="form-label">Access Duration (Days)</label><input required min="1" type="number" className="form-control" value={form.access_duration_days} onChange={e=>setForm({...form,access_duration_days:e.target.value})}/></div>
 <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
 <div className="col-12 d-flex justify-content-between align-items-center"><div className="form-check"><input className="form-check-input" type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/><label className="form-check-label">Active</label></div><button className="btn btn-primary">Create Course</button></div>
 </div></form></div></div>
 <div className="card border-0 shadow-sm"><div className="card-body border-bottom"><h5 className="fw-bold mb-0">Courses</h5></div>{loading?<div className="p-5 text-center text-muted">Loading...</div>:courses.length===0?<div className="p-5 text-center text-muted">No recorded courses created yet.</div>:<div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Course</th><th>Price</th><th>Access</th><th>Lessons</th><th>Status</th><th></th></tr></thead><tbody>{courses.map(c=><tr key={c.id}><td><div className="fw-semibold">{c.title}</div><small className="text-muted">{c.description||"No description"}</small></td><td>{money(c.price)}</td><td>{c.access_duration_days} days</td><td>{c.lesson_count}</td><td><span className={`badge ${c.is_active?"bg-success":"bg-secondary"}`}>{c.is_active?"Active":"Inactive"}</span></td><td><Link href={`/college-admin/recorded-courses/${c.id}`} className="btn btn-outline-primary btn-sm">Manage</Link></td></tr>)}</tbody></table></div>}</div>
 </div></div></main></div>
}