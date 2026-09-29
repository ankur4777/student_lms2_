"use client";

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

interface ParentProfile {
  name: string;
  username: string;
  email: string;
  phone: string;
  occupation: string;
  organization: string | null;
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

function getSavedParent() {
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
}

export default function ParentProfilePage() {
  const router = useRouter();

  const [parent] = useState<ParentUser>(getSavedParent);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
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

    const clearParentSession = () => {
      localStorage.removeItem("parent_access_token");
      localStorage.removeItem("parent_refresh_token");
      localStorage.removeItem("parent_user");
    };

    const fetchJson = async (url: string) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        throw new Error("Unauthorized");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load profile."
        );
      }

      return result;
    };

    const loadProfile = async () => {
      try {
        const [profileResult, childrenResult] =
          await Promise.all([
            fetchJson(`${API_BASE}/api/accounts/parent/profile/`),
            fetchJson(`${API_BASE}/api/accounts/parent/children/`),
          ]);

        if (isMounted) {
          setProfile(profileResult.profile || null);
          setChildren(childrenResult.children || []);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(
            err.message === "Unauthorized"
              ? ""
              : err.message
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={
            profile?.name ||
            parent.name ||
            parent.username ||
            "Parent"
          }
          organization={
            profile?.organization ||
            parent.organization ||
            ""
          }
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Profile
              </h2>

              <p className="text-muted mb-0">
                View your parent account details.
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
                  Loading profile...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Parent Information
                    </h5>

                    <div className="row g-4">
                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Name
                        </div>

                        <div className="fw-semibold">
                          {profile?.name || "-"}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Username
                        </div>

                        <div className="fw-semibold">
                          {profile?.username || "-"}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Email
                        </div>

                        <div className="fw-semibold">
                          {profile?.email || "-"}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Phone
                        </div>

                        <div className="fw-semibold">
                          {profile?.phone || "-"}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          Occupation
                        </div>

                        <div className="fw-semibold">
                          {profile?.occupation || "-"}
                        </div>
                      </div>

                      <div className="col-md-6 col-xl-4">
                        <div className="text-muted small">
                          College/Organization
                        </div>

                        <div className="fw-semibold">
                          {profile?.organization || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Linked Children
                    </h5>

                    {children.length === 0 ? (
                      <p className="text-muted mb-0">
                        No linked children found.
                      </p>
                    ) : (
                      <div className="row g-4">
                        {children.map((child) => (
                          <div
                            className="col-md-6 col-xl-4"
                            key={child.student_profile_id}
                          >
                            <div className="border rounded p-3 h-100">
                              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <div>
                                  <h6 className="fw-bold mb-1">
                                    {child.name}
                                  </h6>

                                  <div className="text-muted">
                                    {child.username}
                                  </div>
                                </div>

                                <span className="badge bg-primary">
                                  {child.relationship || "-"}
                                </span>
                              </div>

                              <div className="row g-3">
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
