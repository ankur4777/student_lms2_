"use client";

export type AdminIconName =
  | "students"
  | "teachers"
  | "classes"
  | "attendance"
  | "fees"
  | "pending"
  | "parents"
  | "sections"
  | "subjects"
  | "enrollments"
  | "assignments"
  | "live"
  | "documents"
  | "results"
  | "actions"
  | "notices"
  | "search"
  | "add"
  | "view"
  | "edit"
  | "back"
  | "mail"
  | "phone"
  | "calendar"
  | "status";

interface AdminIconProps {
  name: AdminIconName;
  className?: string;
  size?: number;
}

export default function AdminIcon({
  name,
  className = "",
  size = 20,
}: AdminIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "students":
      return (
        <svg {...common} className={className}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "teachers":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
          <path d="M17.5 4.5 20 2" />
        </svg>
      );
    case "classes":
      return (
        <svg {...common} className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10M7 12h6M7 16h8" />
        </svg>
      );
    case "attendance":
      return (
        <svg {...common} className={className}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="m8 15 2 2 5-5" />
        </svg>
      );
    case "fees":
      return (
        <svg {...common} className={className}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 9h19M15 14h3" />
        </svg>
      );
    case "pending":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "parents":
      return (
        <svg {...common} className={className}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16.5" cy="9" r="2.5" />
          <path d="M2.5 21a6 6 0 0 1 11 0M13 21a5 5 0 0 1 8.5-3.5" />
        </svg>
      );
    case "sections":
      return (
        <svg {...common} className={className}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h8" />
        </svg>
      );
    case "subjects":
      return (
        <svg {...common} className={className}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
          <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
        </svg>
      );
    case "enrollments":
      return (
        <svg {...common} className={className}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="m16 14 2 2 4-5" />
        </svg>
      );
    case "assignments":
      return (
        <svg {...common} className={className}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case "live":
      return (
        <svg {...common} className={className}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3z" />
        </svg>
      );
    case "documents":
      return (
        <svg {...common} className={className}>
          <path d="M6 2h8l4 4v16H6z" />
          <path d="M14 2v5h5M9 12h6M9 16h6" />
        </svg>
      );
    case "results":
      return (
        <svg {...common} className={className}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "actions":
      return (
        <svg {...common} className={className}>
          <path d="m13 2-9 12h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "notices":
      return (
        <svg {...common} className={className}>
          <path d="M3 11v2h4l8 4V7l-8 4z" />
          <path d="M7 13v6M18 9a4 4 0 0 1 0 6" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "add":
      return (
        <svg {...common} className={className}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "view":
      return (
        <svg {...common} className={className}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common} className={className}>
          <path d="M4 20h4l11-11-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      );
    case "back":
      return (
        <svg {...common} className={className}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common} className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common} className={className}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.65 2.63a2 2 0 0 1-.45 2.11L8 9.77a16 16 0 0 0 6 6l1.31-1.31a2 2 0 0 1 2.11-.45c.85.31 1.73.53 2.63.65A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} className={className}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "status":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    default:
      return null;
  }
}
