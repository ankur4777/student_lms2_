"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";
import TeacherIcon from "@/components/teacher/TeacherIcon";

interface TeacherTopbarProps {
  name: string;
  organization: string;
}

function initials(name: string) {
  const value = (name || "T").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : value.slice(0, 2)
  ).toUpperCase();
}

export default function TeacherTopbar({
  name,
  organization,
}: TeacherTopbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
    router.replace("/teacher/login");
  };

  return (
    <>
      <NotificationPopup
        role="teacher"
        tokenKey="teacher_access_token"
        userStorageKey="teacher_user"
        loginPath="/teacher/login"
      />

      <header className="teacher-topbar teacher-portal-topbar">
        <div className="teacher-portal-topbar-title">
          <h4 className="mb-1">Teacher Portal</h4>
          <p className="mb-0">Manage classes, attendance, assignments and academic work.</p>
        </div>

        <div className="teacher-portal-topbar-actions">
          {organization && (
            <div className="teacher-portal-organization">
              <TeacherIcon name="school" size={16} />
              <span>{organization}</span>
            </div>
          )}

          <div className="teacher-portal-user">
            <span className="teacher-portal-avatar">
              {initials(name)}
            </span>
            <div>
              <strong>{name}</strong>
              <small>Teacher</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm teacher-portal-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
