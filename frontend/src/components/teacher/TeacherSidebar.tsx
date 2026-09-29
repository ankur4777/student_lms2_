"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import TeacherIcon, { TeacherIconName } from "@/components/teacher/TeacherIcon";

type TeacherNavItem = {
  label: string;
  href: string;
  icon: TeacherIconName;
};

type TeacherNavSection = {
  label: string;
  items: TeacherNavItem[];
};

const navSections: TeacherNavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/teacher/dashboard", icon: "dashboard" },
    ],
  },
  {
    label: "Teaching",
    items: [
      { label: "My Classes", href: "/teacher/classes", icon: "classes" },
      { label: "Recordings", href: "/teacher/recordings", icon: "recordings" },
      { label: "Attendance", href: "/teacher/attendance", icon: "attendance" },
      { label: "Assignments", href: "/teacher/assignments", icon: "assignments" },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Students", href: "/teacher/students", icon: "students" },
      { label: "Results", href: "/teacher/results", icon: "results" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Documents", href: "/teacher/documents", icon: "documents" },
      {
        label: "Notifications",
        href: "/teacher/notifications",
        icon: "notifications",
      },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/teacher/profile", icon: "profile" },
    ],
  },
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/teacher/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle teacher-menu-toggle"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      <div
        className={`dashboard-menu-backdrop ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`teacher-sidebar teacher-portal-sidebar ${open ? "sidebar-open" : ""}`}
      >
        <div className="teacher-sidebar-brand teacher-portal-brand">
          <span className="teacher-brand-logo">
            <TeacherIcon name="school" size={22} />
          </span>
          <div>
            <strong>Shabdd LMS</strong>
            <small>Teacher Portal</small>
          </div>
        </div>

        <nav className="teacher-sidebar-nav teacher-portal-nav">
          {navSections.map((section) => (
            <section className="teacher-nav-section" key={section.label}>
              <div className="teacher-nav-section-title">{section.label}</div>

              <div className="teacher-nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "active" : ""}
                    onClick={() => setOpen(false)}
                  >
                    <span className="teacher-nav-label">
                      <span className="teacher-nav-icon">
                        <TeacherIcon name={item.icon} size={18} />
                      </span>
                      <span className="teacher-nav-text">{item.label}</span>
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
