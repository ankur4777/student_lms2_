"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import AdminIcon, { AdminIconName } from "@/components/college-admin/AdminIcon";

type MenuItem = {
  label: string;
  href: string;
  icon: AdminIconName;
};

type MenuSection = {
  key: string;
  label: string;
  icon: AdminIconName;
  items: MenuItem[];
};

const dashboardItem: MenuItem = {
  label: "Dashboard",
  href: "/college-admin/dashboard",
  icon: "results",
};

const menuSections: MenuSection[] = [
  {
    key: "people",
    label: "People",
    icon: "students",
    items: [
      { label: "Students", href: "/college-admin/students", icon: "students" },
      { label: "Teachers", href: "/college-admin/teachers", icon: "teachers" },
      { label: "Parents", href: "/college-admin/parents", icon: "parents" },
      {
        label: "Parent-Student Links",
        href: "/college-admin/parent-student-links",
        icon: "enrollments",
      },
    ],
  },
  {
    key: "academics",
    label: "Academic Setup",
    icon: "classes",
    items: [
      {
        label: "Academic Sessions",
        href: "/college-admin/academic-sessions",
        icon: "calendar",
      },
      { label: "Classes", href: "/college-admin/classes", icon: "classes" },
      { label: "Sections", href: "/college-admin/sections", icon: "sections" },
      { label: "Subjects", href: "/college-admin/subjects", icon: "subjects" },
      {
        label: "Enrollments",
        href: "/college-admin/enrollments",
        icon: "enrollments",
      },
      {
        label: "Teacher Assignments",
        href: "/college-admin/teacher-assignments",
        icon: "assignments",
      },
      {
        label: "Class Feature Access",
        href: "/college-admin/class-feature-access",
        icon: "assignments",
      },
    ],
  },
  {
    key: "learning",
    label: "Teaching & Learning",
    icon: "live",
    items: [
      {
        label: "Live Classes",
        href: "/college-admin/live-classes",
        icon: "live",
      },
      {
        label: "Attendance",
        href: "/college-admin/attendance",
        icon: "attendance",
      },
      {
        label: "Assignments",
        href: "/college-admin/assignments",
        icon: "assignments",
      },
      { label: "Results", href: "/college-admin/results", icon: "results" },
      {
        label: "Documents",
        href: "/college-admin/documents",
        icon: "documents",
      },
      {
        label: "Recorded Courses",
        href: "/college-admin/recorded-courses",
        icon: "live",
      },
    ],
  },
  {
    key: "finance",
    label: "Finance & Reports",
    icon: "fees",
    items: [
      { label: "Fees", href: "/college-admin/fees", icon: "fees" },
      {
        label: "Course Purchases",
        href: "/college-admin/recorded-course-purchases",
        icon: "fees",
      },
      {
        label: "Reports & Analytics",
        href: "/college-admin/reports",
        icon: "results",
      },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    icon: "notices",
    items: [
      {
        label: "Notifications",
        href: "/college-admin/notifications",
        icon: "pending",
      },
      { label: "Notices", href: "/college-admin/notices", icon: "notices" },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: "teachers",
    items: [
      { label: "Profile", href: "/college-admin/profile", icon: "teachers" },
    ],
  },
];

export default function CollegeAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = useCallback(
    (href: string) => {
      if (pathname === href) {
        return true;
      }

      if (href === "/college-admin/dashboard") {
        return false;
      }

      return pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  const activeSectionKey = useMemo(() => {
    return (
      menuSections.find((section) =>
        section.items.some((item) => isActive(item.href))
      )?.key || null
    );
  }, [isActive]);

  const [openGroup, setOpenGroup] = useState<string | null>(activeSectionKey);

  useEffect(() => {
    if (activeSectionKey) {
      setOpenGroup(activeSectionKey);
    }
  }, [activeSectionKey]);

  const loadUnreadCount = useCallback(async () => {
    const token = localStorage.getItem("college_admin_access_token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/notifications/unread-count/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      setUnreadCount(result.unread_count || 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUnreadCount();
    });
  }, [loadUnreadCount]);

  const toggleGroup = (key: string) => {
    setOpenGroup((current) => (current === key ? null : key));
  };

  const closeMobileMenu = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle"
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
        className={`teacher-sidebar ${open ? "sidebar-open" : ""}`}
        style={{
          height: "100vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div className="teacher-sidebar-brand">
          Shabdd LMS
          <div className="small text-muted fw-normal mt-1">College Admin</div>
        </div>

        <nav className="teacher-sidebar-nav college-admin-grouped-nav">
          <Link
            href={dashboardItem.href}
            className={`college-admin-dashboard-link ${isActive(dashboardItem.href) ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            <span className="college-admin-nav-label">
              <AdminIcon name={dashboardItem.icon} size={18} />
              <span>{dashboardItem.label}</span>
            </span>
          </Link>

          <div className="college-admin-nav-divider" />

          {menuSections.map((section) => {
            const expanded = openGroup === section.key;
            const sectionActive = section.items.some((item) =>
              isActive(item.href)
            );
            const showUnread =
              section.key === "communication" && unreadCount > 0;

            return (
              <div
                className={`college-admin-menu-group ${sectionActive ? "has-active-child" : ""}`}
                key={section.key}
              >
                <button
                  type="button"
                  className={`college-admin-menu-group-toggle ${sectionActive ? "active" : ""}`}
                  aria-expanded={expanded}
                  aria-controls={`college-admin-group-${section.key}`}
                  onClick={() => toggleGroup(section.key)}
                >
                  <span className="college-admin-nav-label">
                    <AdminIcon name={section.icon} size={18} />
                    <span>{section.label}</span>
                  </span>

                  <span className="college-admin-menu-group-meta">
                    {showUnread && (
                      <span className="college-admin-group-badge">
                        {unreadCount}
                      </span>
                    )}
                    <span
                      className={`college-admin-menu-chevron ${expanded ? "open" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                <div
                  id={`college-admin-group-${section.key}`}
                  className={`college-admin-submenu ${expanded ? "open" : ""}`}
                >
                  <div className="college-admin-submenu-inner">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={isActive(item.href) ? "active" : ""}
                        onClick={closeMobileMenu}
                      >
                        <span className="college-admin-nav-label">
                          <AdminIcon name={item.icon} size={16} />
                          <span>{item.label}</span>
                        </span>

                        {item.href === "/college-admin/notifications" &&
                          unreadCount > 0 && (
                            <span className="college-admin-submenu-badge">
                              {unreadCount}
                            </span>
                          )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-product-credit">
          <ProductCredit />
        </div>
      </aside>
    </>
  );
}
