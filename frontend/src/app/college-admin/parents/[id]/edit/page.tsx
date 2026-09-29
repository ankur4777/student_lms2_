"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface ParentProfile {
  phone: string;
  occupation: string;
}

interface Parent {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  profile: ParentProfile | null;
}

function getSavedAdmin() {
  if (typeof window === "undefined") {
    return {};
  }
  const saved = localStorage.getItem("college_admin_user");
  if (!saved) {
    return {};
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

export default function CollegeAdminEditParentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [isActive, setIsActive] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return "";
    }
    return token;
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    const loadParent = async () => {
      const token = getToken();
      if (!token) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/parents/${params.id}/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load parent.");
        }
        const parent = result.parent as Parent;
        if (isMounted) {
          setFirstName(parent.first_name || "");
          setLastName(parent.last_name || "");
          setUsername(parent.username || "");
          setEmail(parent.email || "");
          setPhone(parent.profile?.phone || "");
          setOccupation(parent.profile?.occupation || "");
          setIsActive(parent.is_active);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void loadParent();
    return () => {
      isMounted = false;
    };
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      const token = getToken();
      if (!token) {
        return;
      }
      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/parents/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            username,
            email,
            phone,
            occupation,
            is_active: isActive,
          }),
        }
      );
      if (response.status === 401) {
        clearSession();
        router.replace("/college-admin/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result?.detail || "Unable to update parent.");
        return;
      }
      router.replace(`/college-admin/parents/${params.id}`);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />
      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />
        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Edit Parent</h2>
              <p className="text-muted mb-0">
                Update safe parent account and profile fields.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading parent...
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">First Name</label>
                        <input
                          className="form-control"
                          value={firstName}
                          onChange={(event) =>
                            setFirstName(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Last Name</label>
                        <input
                          className="form-control"
                          value={lastName}
                          onChange={(event) =>
                            setLastName(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Username</label>
                        <input
                          className="form-control"
                          value={username}
                          onChange={(event) =>
                            setUsername(event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Email</label>
                        <input
                          className="form-control"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Phone</label>
                        <input
                          className="form-control"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Occupation</label>
                        <input
                          className="form-control"
                          value={occupation}
                          onChange={(event) =>
                            setOccupation(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            id="is-active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) =>
                              setIsActive(event.target.checked)
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="is-active"
                          >
                            Active parent account
                          </label>
                        </div>
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            router.push(`/college-admin/parents/${params.id}`)
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
