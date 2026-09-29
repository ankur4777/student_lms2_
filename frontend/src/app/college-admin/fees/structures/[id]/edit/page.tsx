"use client";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import FeeStructureForm from "@/components/college-admin/FeeStructureForm";
import { useParams } from "next/navigation";
import { useState } from "react";
import "../../../../../teacher/dashboard/dashboard.css";
function saved(){if(typeof window==="undefined")return{};try{return JSON.parse(localStorage.getItem("college_admin_user")||"{}")}catch{return{}}}
export default function EditFeeStructurePage(){const p=useParams<{id:string}>(),[a]=useState<any>(saved);return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main"><CollegeAdminTopbar name={a.name||a.username||"College Admin"} organization={a.organization||""}/><div className="teacher-dashboard-content"><div className="container-fluid"><div className="mb-4"><h2 className="fw-bold mb-1">Edit Fee Structure</h2><p className="text-muted mb-0">Update fee structure details and components.</p></div><FeeStructureForm structureId={p.id}/></div></div></main></div>}