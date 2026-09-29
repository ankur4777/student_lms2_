"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import StudentIcon, { StudentIconName } from "@/components/student/StudentIcon";

type StudentFeatureKey =
  | "classes"
  | "recorded_classes"
  | "recorded_courses"
  | "attendance"
  | "assignments"
  | "results"
  | "documents"
  | "fees"
  | "notifications";

type StudentNavItem = {
  label: string;
  href: string;
  icon: StudentIconName;
  featureKey?: StudentFeatureKey;
};

type StudentNavSection = {
  label: string;
  items: StudentNavItem[];
};

const navSections: StudentNavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "My Classes", href: "/student/classes", icon: "classes", featureKey: "classes" },
      { label: "Recorded Classes", href: "/student/recorded-classes", icon: "recordings", featureKey: "recorded_classes" },
      { label: "Buy Recorded Courses", href: "/student/recorded-courses", icon: "courses", featureKey: "recorded_courses" },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Attendance", href: "/student/attendance", icon: "attendance", featureKey: "attendance" },
      { label: "Assignments", href: "/student/assignments", icon: "assignments", featureKey: "assignments" },
      { label: "Results", href: "/student/results", icon: "results", featureKey: "results" },
      { label: "Documents", href: "/student/documents", icon: "documents", featureKey: "documents" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fees", href: "/student/fees", icon: "fees", featureKey: "fees" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications", href: "/student/notifications", icon: "notifications", featureKey: "notifications" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/student/profile", icon: "profile" },
    ],
  },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [featureAccess, setFeatureAccess] = useState<
    Partial<Record<StudentFeatureKey, boolean>> | null
  >(null);

  useEffect(() => {
    let active = true;

    const loadFeatureAccess = async () => {
      const token = localStorage.getItem("student_access_token");

      if (!token) {
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/academics/student/feature-access/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        if (active) {
          setFeatureAccess(result.features || {});
        }
      } catch {
        // Keep the existing navigation visible if access settings cannot load.
      }
    };

    void loadFeatureAccess();

    return () => {
      active = false;
    };
  }, []);

  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              !item.featureKey ||
              featureAccess === null ||
              featureAccess[item.featureKey] !== false
          ),
        }))
        .filter((section) => section.items.length > 0),
    [featureAccess]
  );

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/student/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle student-menu-toggle"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      <div
        className={`dashboard-menu-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`student-sidebar student-portal-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand student-portal-brand">
          <span className="student-brand-logo">
            <StudentIcon name="school" size={22} />
          </span>

          <div>
            <h5>Shabdd LMS</h5>
            <small>Student Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav student-portal-nav">
          {visibleNavSections.map((section) => (
            <section className="student-nav-section" key={section.label}>
              <div className="student-nav-section-title">{section.label}</div>

              <div className="student-nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "active" : ""}
                    onClick={() => setOpen(false)}
                  >
                    <span className="student-nav-label">
                      <span className="student-nav-icon">
                        <StudentIcon name={item.icon} size={18} />
                      </span>
                      <span className="student-nav-text">{item.label}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-product-credit">
          <ProductCredit />
        </div>
      </aside>
    </>
  );
}
