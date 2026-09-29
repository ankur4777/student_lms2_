"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";
import { useCurrency } from "@/hooks/useCurrency";
import "../dashboard/dashboard.css";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL;
type Course={id:number;title:string;description:string;price:string;access_duration_days:number;lesson_count:number;has_access:boolean;access_expires_at:string|null};
type Purchase={id:number;course:{id:number;title:string};amount:string;status:string;created_at:string};

export default function StudentRecordedCoursesPage(){
 const router=useRouter();const [student,setStudent]=useState<any>({});const [courses,setCourses]=useState<Course[]>([]);const [purchases,setPurchases]=useState<Purchase[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [busy,setBusy]=useState<number|null>(null);const { formatCurrency: money } = useCurrency();
 const load=useCallback(async()=>{const token=localStorage.getItem("student_access_token");if(!token){router.replace("/student/login");return}setLoading(true);setError("");try{const h={Authorization:`Bearer ${token}`};const [cr,pr]=await Promise.all([fetch(`${API_BASE}/api/recorded-courses/student/catalog/`,{headers:h}),fetch(`${API_BASE}/api/recorded-courses/student/purchases/`,{headers:h})]);if(cr.status===401||pr.status===401){router.replace("/student/login");return}const cj=await cr.json(),pj=await pr.json();if(!cr.ok)throw new Error(cj.detail||"Unable to load recorded courses.");if(!pr.ok)throw new Error(pj.detail||"Unable to load purchases.");setCourses(cj.courses||[]);setPurchases(pj.purchases||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load recorded courses.")}finally{setLoading(false)}},[router]);
 useEffect(()=>{try{setStudent(JSON.parse(localStorage.getItem("student_user")||"{}"))}catch{};void load()},[load]);
 const pending=(id:number)=>purchases.find(p=>p.course.id===id&&p.status==="pending");
 async function purchase(courseId:number){const token=localStorage.getItem("student_access_token");if(!token)return;setBusy(courseId);setError("");try{const r=await fetch(`${API_BASE}/api/recorded-courses/student/purchases/`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({course_id:courseId})});const j=await r.json();if(!r.ok)throw new Error(j.detail||"Unable to create purchase.");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to create purchase.")}finally{setBusy(null)}}
 return <div className="student-dashboard"><StudentSidebar/><main className="student-dashboard-main"><StudentTopbar name={student.name||student.username||"Student"} organization={student.organization||""}/><div className="student-dashboard-content"><div className="container-fluid">
 {isClassFeatureRestricted(error)?<StudentFeatureRestricted featureName="Recorded Courses" />:<>
 <div className="mb-4"><h2 className="fw-bold mb-1">Recorded Courses</h2><p className="text-muted mb-0">Purchase recorded courses offered by your college.</p></div>{error&&<div className="alert alert-danger">{error}</div>}
 {loading?<div className="dashboard-panel"><div className="empty-state">Loading recorded courses...</div></div>:courses.length===0?<div className="dashboard-panel"><div className="empty-state">No recorded courses are currently available.</div></div>:<div className="row g-4">{courses.map(c=><div className="col-md-6 col-xl-4" key={c.id}><div className="card border-0 shadow-sm h-100"><div className="card-body d-flex flex-column"><h5 className="fw-bold">{c.title}</h5><p className="text-muted flex-grow-1">{c.description||"Recorded course"}</p><div className="d-flex justify-content-between mb-2"><span>Lessons</span><strong>{c.lesson_count}</strong></div><div className="d-flex justify-content-between mb-3"><span>Access</span><strong>{c.access_duration_days} days</strong></div><div className="fs-4 fw-bold mb-3">{money(c.price)}</div>{c.has_access?<div className="alert alert-success py-2 mb-0">Access Active</div>:pending(c.id)?<div className="alert alert-warning py-2 mb-0">Purchase Pending Verification</div>:<button className="btn btn-primary" disabled={busy===c.id} onClick={()=>purchase(c.id)}>{busy===c.id?"Processing...":"Purchase Course"}</button>}</div></div></div>)}</div>}
 {purchases.length>0&&<div className="dashboard-panel mt-4"><div className="panel-heading"><h5>My Purchases</h5></div><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Course</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>{purchases.map(p=><tr key={p.id}><td>{p.course.title}</td><td>{money(p.amount)}</td><td><span className={`badge ${p.status==="paid"?"bg-success":p.status==="pending"?"bg-warning text-dark":"bg-secondary"}`}>{p.status.toUpperCase()}</span></td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>}
 </>}
 </div></div></main></div>
}