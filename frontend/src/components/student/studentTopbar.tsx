"use client";

import { useRouter } from "next/navigation";

import NotificationPopup from "@/components/notifications/NotificationPopup";
import StudentIcon from "@/components/student/StudentIcon";

interface StudentTopbarProps {
  name: string;
  organization?: string;
}

function initials(name: string) {
  const value = (name || "S").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : value.slice(0, 2)
  ).toUpperCase();
}

export default function StudentTopbar({
  name,
  organization,
}: StudentTopbarProps) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_user");
    router.replace("/student/login");
  }

  return (
    <>
      <NotificationPopup
        role="student"
        tokenKey="student_access_token"
        userStorageKey="student_user"
        loginPath="/student/login"
      />

      <header className="student-topbar student-portal-topbar">
        <div className="student-portal-topbar-title">
          <h4 className="mb-1">Student Portal</h4>
          <p className="mb-0">Classes, attendance, assignments and learning resources.</p>
        </div>

        <div className="student-portal-topbar-actions">
          {organization && (
            <div className="student-portal-organization">
              <StudentIcon name="school" size={16} />
              <span>{organization}</span>
            </div>
          )}

          <div className="student-portal-user">
            <span className="student-portal-avatar">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              <small>Student</small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm student-portal-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
