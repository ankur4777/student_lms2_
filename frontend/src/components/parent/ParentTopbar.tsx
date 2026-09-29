"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";
import ParentIcon from "@/components/parent/ParentIcon";

interface ParentTopbarProps {
  name: string;
  organization?: string;
}

function initials(name: string) {
  const value = (name || "P").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : value.slice(0, 2)
  ).toUpperCase();
}

export default function ParentTopbar({
  name,
  organization,
}: ParentTopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
    router.replace("/parent/login");
  };

  return (
    <>
      <NotificationPopup
        role="parent"
        tokenKey="parent_access_token"
        userStorageKey="parent_user"
        loginPath="/parent/login"
      />

      <header className="student-topbar parent-topbar">
        <div className="parent-topbar-title">
          <h4 className="mb-1">Parent Portal</h4>
          <p className="mb-0">Welcome back, {name}</p>
        </div>

        <div className="parent-topbar-actions">
          {organization && (
            <div className="parent-topbar-organization">
              <ParentIcon name="school" size={16} />
              <span>{organization}</span>
            </div>
          )}

          <div className="parent-topbar-user">
            <span className="parent-topbar-avatar">
              {initials(name)}
            </span>
            <div>
              <strong>{name}</strong>
              <small>Parent</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm parent-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
