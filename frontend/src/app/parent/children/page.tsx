"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  relationship: string;
}

export default function ParentChildrenPage() {
  const router = useRouter();

  const [parent] = useState<ParentUser>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const savedParent = localStorage.getItem("parent_user");

    if (!savedParent) {
      return {};
    }

    try {
      return JSON.parse(savedParent);
    } catch {
      return {};
    }
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    let isMounted = true;

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    const loadChildren = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/parent/children/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("parent_access_token");
          localStorage.removeItem("parent_refresh_token");
          localStorage.removeItem("parent_user");
          router.replace("/parent/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail || "Unable to load children."
          );
        }

        if (isMounted) {
          setChildren(result.children || []);
        }
      } catch (err) {
        if (isMounted) {
          setChildren([]);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load children."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadChildren();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={parent.name || parent.username || "Parent"}
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                My Children
              </h2>

              <p className="text-muted mb-0">
                View linked student details and open their records.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading children...
                </div>
              </div>
            ) : children.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">
                    No Linked Children
                  </h5>

                  <p className="text-muted mb-0">
                    Linked student details will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="row g-4">
                {children.map((child) => (
                  <div
                    className="col-md-6 col-xl-4"
                    key={child.student_profile_id}
                  >
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                          <div>
                            <h5 className="fw-bold mb-1">
                              {child.name}
                            </h5>

                            <div className="text-muted">
                              {child.username}
                            </div>
                          </div>

                          <span className="badge bg-primary">
                            {child.relationship}
                          </span>
                        </div>

                        <div className="row g-3 mb-4">
                          <div className="col-6">
                            <div className="text-muted small">
                              Roll Number
                            </div>

                            <div className="fw-semibold">
                              {child.roll_number || "-"}
                            </div>
                          </div>

                          <div className="col-6">
                            <div className="text-muted small">
                              Class
                            </div>

                            <div className="fw-semibold">
                              {child.classroom_name || "-"}
                            </div>
                          </div>

                          <div className="col-6">
                            <div className="text-muted small">
                              Section
                            </div>

                            <div className="fw-semibold">
                              {child.section_name || "-"}
                            </div>
                          </div>

                          <div className="col-6">
                            <div className="text-muted small">
                              Relationship
                            </div>

                            <div className="fw-semibold">
                              {child.relationship || "-"}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                          <Link
                            className="btn btn-outline-primary btn-sm"
                            href="/parent/attendance"
                          >
                            Attendance
                          </Link>

                          <Link
                            className="btn btn-outline-primary btn-sm"
                            href="/parent/assignments"
                          >
                            Assignments
                          </Link>

                          <Link
                            className="btn btn-outline-primary btn-sm"
                            href="/parent/results"
                          >
                            Results
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
