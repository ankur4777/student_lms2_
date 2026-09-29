"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface AccountInfo {
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface OrganizationInfo {
  name: string;
  code: string;
  primary_color: string;
  secondary_color: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  domain: string;
  is_active: boolean;
  status: string;
  logo: string;
}

interface ProfileResponse {
  account: AccountInfo;
  organization: OrganizationInfo | null;
  message?: string;
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

function formatValue(value?: string | null) {
  if (!value) {
    return "-";
  }
  return value;
}

function formatRole(value: string) {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CollegeAdminProfilePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser>(getSavedAdmin);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [organization, setOrganization] =
    useState<OrganizationInfo | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [institutionEmail, setInstitutionEmail] = useState("");
  const [institutionPhone, setInstitutionPhone] = useState("");
  const [institutionAddress, setInstitutionAddress] = useState("");
  const [institutionWebsite, setInstitutionWebsite] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0d6efd");
  const [secondaryColor, setSecondaryColor] = useState("#6c757d");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingInstitution, setSavingInstitution] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const applyProfile = useCallback((result: ProfileResponse) => {
    setAccount(result.account);
    setOrganization(result.organization);
    setFirstName(result.account.first_name || "");
    setLastName(result.account.last_name || "");
    setEmail(result.account.email || "");
    setInstitutionEmail(result.organization?.email || "");
    setInstitutionPhone(result.organization?.phone || "");
    setInstitutionAddress(result.organization?.address || "");
    setInstitutionWebsite(result.organization?.website || "");
    setPrimaryColor(result.organization?.primary_color || "#0d6efd");
    setSecondaryColor(result.organization?.secondary_color || "#6c757d");

    setAdmin((currentAdmin) => {
      const nextAdmin = {
        ...currentAdmin,
        name: result.account.name,
        username: result.account.username,
        organization: result.organization?.name || "",
      };
      localStorage.setItem(
        "college_admin_user",
        JSON.stringify(nextAdmin)
      );
      return nextAdmin;
    });
  }, []);

  const fetchProfile = useCallback(async (
    options: RequestInit = {}
  ) => {
    const token = getToken();
    if (!token) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(
      `${API_BASE}/api/accounts/college-admin/profile/`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }
    );

    if (response.status === 401) {
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.detail || "Unable to load profile.");
    }

    return result as ProfileResponse;
  }, [clearSession, getToken, router]);

  const fetchInstitutionSettings = useCallback(async (
    options: RequestInit = {}
  ) => {
    const token = getToken();
    if (!token) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(
      `${API_BASE}/api/accounts/college-admin/institution-settings/`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }
    );

    if (response.status === 401) {
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Unable to update institution settings."
      );
    }

    return result as {
      institution?: OrganizationInfo;
      message?: string;
    } & OrganizationInfo;
  }, [clearSession, getToken, router]);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const result = await fetchProfile();
        if (isMounted) {
          applyProfile(result);
        }
      } catch (err) {
        if (
          isMounted &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
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
  }, [applyProfile, fetchProfile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const result = await fetchProfile({
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
        }),
      });
      applyProfile(result);
      setSuccess(result.message || "Profile updated successfully.");
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInstitutionSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    try {
      setSavingInstitution(true);
      setError("");
      setSuccess("");

      const payload = new FormData();
      payload.append("primary_color", primaryColor);
      payload.append("secondary_color", secondaryColor);
      payload.append("email", institutionEmail);
      payload.append("phone", institutionPhone);
      payload.append("address", institutionAddress);
      payload.append("website", institutionWebsite);
      if (logoFile) {
        payload.append("logo", logoFile);
      }

      const result = await fetchInstitutionSettings({
        method: "PATCH",
        body: payload,
      });
      const updatedInstitution = result.institution || result;
      setOrganization(updatedInstitution);
      setLogoFile(null);
      setSuccess(
        result.message || "Institution settings updated successfully."
      );
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setSavingInstitution(false);
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
              <h2 className="fw-bold mb-1">Profile</h2>
              <p className="text-muted mb-0">
                View your account and institution information.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && (
              <div className="alert alert-success">{success}</div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading profile...
                </div>
              </div>
            ) : account ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">My Profile</h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Name</div>
                        <div className="fw-semibold">{account.name}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Username</div>
                        <div className="fw-semibold">
                          {account.username}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Email</div>
                        <div className="fw-semibold">
                          {formatValue(account.email)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Role</div>
                        <div className="fw-semibold">
                          {formatRole(account.role)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Status</div>
                        <span
                          className={
                            account.is_active
                              ? "badge bg-success"
                              : "badge bg-secondary"
                          }
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Edit Profile
                    </h5>
                    <form onSubmit={handleSubmit}>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">First Name</label>
                          <input
                            className="form-control"
                            value={firstName}
                            onChange={(event) =>
                              setFirstName(event.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Last Name</label>
                          <input
                            className="form-control"
                            value={lastName}
                            onChange={(event) =>
                              setLastName(event.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Email</label>
                          <input
                            className="form-control"
                            type="email"
                            value={email}
                            onChange={(event) =>
                              setEmail(event.target.value)
                            }
                          />
                        </div>
                        <div className="col-12">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Institution Information
                    </h5>
                    {organization ? (
                      <div className="row g-4">
                        {organization.logo && (
                          <div className="col-12">
                            <div className="text-muted small mb-2">
                              Current Logo
                            </div>
                            <img
                              alt={`${organization.name} logo`}
                              className="rounded border bg-white p-2"
                              src={organization.logo}
                              style={{
                                height: 90,
                                maxWidth: 180,
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        )}
                        <div className="col-md-4">
                          <div className="text-muted small">Name</div>
                          <div className="fw-semibold">
                            {organization.name}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Code</div>
                          <div className="fw-semibold">
                            {organization.code}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Email</div>
                          <div className="fw-semibold">
                            {formatValue(organization.email)}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Phone</div>
                          <div className="fw-semibold">
                            {formatValue(organization.phone)}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Website</div>
                          <div className="fw-semibold">
                            {formatValue(organization.website)}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Domain</div>
                          <div className="fw-semibold">
                            {formatValue(organization.domain)}
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="text-muted small">Status</div>
                          <span
                            className={
                              organization.is_active
                                ? "badge bg-success"
                                : "badge bg-secondary"
                            }
                          >
                            {organization.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>
                        <div className="col-12">
                          <div className="text-muted small">Address</div>
                          <div className="fw-semibold">
                            {formatValue(organization.address)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted">
                        Organization information is not available.
                      </div>
                    )}
                  </div>
                </div>

                {organization && (
                  <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                      <h5 className="fw-bold mb-4">
                        Edit Institution Settings
                      </h5>
                      <form onSubmit={handleInstitutionSubmit}>
                        <div className="row g-3">
                          <div className="col-md-6">
                            {organization.logo && (
                              <div className="mb-3">
                                <div className="text-muted small mb-2">
                                  Current Logo
                                </div>
                                <img
                                  alt={`${organization.name} logo`}
                                  className="rounded border bg-white p-2"
                                  src={organization.logo}
                                  style={{
                                    height: 80,
                                    maxWidth: 160,
                                    objectFit: "contain",
                                  }}
                                />
                              </div>
                            )}
                            <label className="form-label">Logo</label>
                            <input
                              className="form-control"
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                setLogoFile(
                                  event.target.files?.[0] || null
                                )
                              }
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">
                              Primary Color
                            </label>
                            <input
                              className="form-control form-control-color"
                              type="color"
                              value={primaryColor}
                              onChange={(event) =>
                                setPrimaryColor(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">
                              Secondary Color
                            </label>
                            <input
                              className="form-control form-control-color"
                              type="color"
                              value={secondaryColor}
                              onChange={(event) =>
                                setSecondaryColor(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Email</label>
                            <input
                              className="form-control"
                              type="email"
                              value={institutionEmail}
                              onChange={(event) =>
                                setInstitutionEmail(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Phone</label>
                            <input
                              className="form-control"
                              value={institutionPhone}
                              onChange={(event) =>
                                setInstitutionPhone(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Website</label>
                            <input
                              className="form-control"
                              type="url"
                              value={institutionWebsite}
                              onChange={(event) =>
                                setInstitutionWebsite(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Address</label>
                            <textarea
                              className="form-control"
                              rows={3}
                              value={institutionAddress}
                              onChange={(event) =>
                                setInstitutionAddress(event.target.value)
                              }
                            />
                          </div>
                          <div className="col-12">
                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={savingInstitution}
                            >
                              {savingInstitution
                                ? "Saving..."
                                : "Save Institution Settings"}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
