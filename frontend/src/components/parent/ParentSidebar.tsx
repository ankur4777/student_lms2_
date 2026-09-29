"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ProductCredit from "@/components/common/ProductCredit";
import ParentIcon, {
  ParentIconName,
} from "@/components/parent/ParentIcon";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type ParentFeatureKey =
  | "attendance"
  | "assignments"
  | "results"
  | "recorded_courses"
  | "fees";

type ParentNavItem = {
  label: string;
  href: string;
  icon: ParentIconName;
  featureKey?: ParentFeatureKey;
};

type ParentNavSection = {
  label: string;
  items: ParentNavItem[];
};

type Child = {
  student_profile_id: number;
};

const navSections: ParentNavSection[] = [
  {
    label: "Main",
    items: [
      {
        label: "Dashboard",
        href: "/parent/dashboard",
        icon: "dashboard",
      },
    ],
  },
  {
    label: "Children & Academics",
    items: [
      {
        label: "My Children",
        href: "/parent/children",
        icon: "children",
      },
      {
        label: "Attendance",
        href: "/parent/attendance",
        icon: "attendance",
        featureKey: "attendance",
      },
      {
        label: "Assignments",
        href: "/parent/assignments",
        icon: "assignments",
        featureKey: "assignments",
      },
      {
        label: "Results",
        href: "/parent/results",
        icon: "results",
        featureKey: "results",
      },
    ],
  },
  {
    label: "Learning",
    items: [
      {
        label: "Recorded Courses",
        href: "/parent/recorded-courses",
        icon: "courses",
        featureKey: "recorded_courses",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Fees",
        href: "/parent/fees",
        icon: "fees",
        featureKey: "fees",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        label: "Notifications",
        href: "/parent/notifications",
        icon: "notifications",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Profile",
        href: "/parent/profile",
        icon: "profile",
      },
    ],
  },
];

const parentFeatureKeys: ParentFeatureKey[] = [
  "attendance",
  "assignments",
  "results",
  "recorded_courses",
  "fees",
];

function allParentFeaturesAllowed() {
  return Object.fromEntries(
    parentFeatureKeys.map((key) => [key, true])
  ) as Record<ParentFeatureKey, boolean>;
}

export default function ParentSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [featureAccess, setFeatureAccess] = useState<
    Record<ParentFeatureKey, boolean> | null
  >(null);

  useEffect(() => {
    let active = true;

    const loadFeatureAccess = async () => {
      const token = localStorage.getItem("parent_access_token");

      if (!token) {
        return;
      }

      try {
        const childrenResponse = await fetch(
          `${API_BASE}/api/accounts/parent/children/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!childrenResponse.ok) {
          return;
        }

        const childrenResult = await childrenResponse.json();
        const children = (childrenResult.children || []) as Child[];

        if (children.length === 0) {
          if (active) {
            setFeatureAccess(allParentFeaturesAllowed());
          }
          return;
        }

        const accessResults = await Promise.all(
          children.map(async (child) => {
            const response = await fetch(
              `${API_BASE}/api/academics/parent/student/${child.student_profile_id}/feature-access/`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
              }
            );

            if (!response.ok) {
              throw new Error(
                "Unable to load parent feature access."
              );
            }

            const result = await response.json();

            return result.features as Partial<
              Record<ParentFeatureKey, boolean>
            >;
          })
        );

        const aggregatedAccess = Object.fromEntries(
          parentFeatureKeys.map((featureKey) => [
            featureKey,
            accessResults.some(
              (features) =>
                features?.[featureKey] !== false
            ),
          ])
        ) as Record<ParentFeatureKey, boolean>;

        if (active) {
          setFeatureAccess(aggregatedAccess);
        }
      } catch {
        // Keep navigation available if access settings cannot be loaded.
        // Backend permissions still protect restricted child data.
        if (active) {
          setFeatureAccess(allParentFeaturesAllowed());
        }
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
    if (href === "/parent/dashboard") return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <button
        type="button"
        className="dashboard-menu-toggle parent-menu-toggle"
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
        className={`student-sidebar parent-sidebar ${
          open ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand parent-sidebar-brand">
          <div className="brand-logo parent-brand-logo">
            <ParentIcon name="children" size={22} />
          </div>

          <div>
            <h5>Shabdd LMS</h5>
            <small>Parent Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav parent-sidebar-nav">
          {visibleNavSections.map((section) => (
            <section
              className="parent-nav-section"
              key={section.label}
            >
              <div className="parent-nav-section-title">
                {section.label}
              </div>

              <div className="parent-nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      isActive(item.href) ? "active" : ""
                    }
                  >
                    <span className="parent-nav-label">
                      <span className="parent-nav-icon">
                        <ParentIcon
                          name={item.icon}
                          size={18}
                        />
                      </span>

                      <span className="parent-nav-text">
                        {item.label}
                      </span>
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
