"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";

interface CollegeAdminTopbarProps {
  name: string;
  organization: string;
}

export default function CollegeAdminTopbar({
  name,
  organization,
}: CollegeAdminTopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");

    router.replace("/college-admin/login");
  };

  return (
    <>
      <NotificationPopup
        role="college_admin"
        tokenKey="college_admin_access_token"
        userStorageKey="college_admin_user"
        loginPath="/college-admin/login"
      />

      <header className="teacher-topbar">
        <div>
          <h4 className="mb-1">
            College Admin Dashboard
          </h4>

          <p className="mb-0 text-muted">
            {organization}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <div>
            <strong>{name}</strong>
            <div className="small text-muted">
              College Admin
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
