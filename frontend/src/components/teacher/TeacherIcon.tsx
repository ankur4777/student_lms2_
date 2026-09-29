"use client";

export type TeacherIconName =
  | "dashboard"
  | "classes"
  | "recordings"
  | "attendance"
  | "assignments"
  | "students"
  | "results"
  | "documents"
  | "notifications"
  | "profile"
  | "school"
  | "calendar"
  | "clock"
  | "video"
  | "arrow";

interface TeacherIconProps {
  name: TeacherIconName;
  className?: string;
  size?: number;
}

export default function TeacherIcon({
  name,
  className = "",
  size = 20,
}: TeacherIconProps) {
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
    case "dashboard":
      return <svg {...common} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case "classes":
      return <svg {...common} className={className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h6M7 16h8" /></svg>;
    case "recordings":
    case "video":
      return <svg {...common} className={className}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>;
    case "attendance":
      return <svg {...common} className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="m8 15 2 2 5-5" /></svg>;
    case "assignments":
      return <svg {...common} className={className}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></svg>;
    case "students":
      return <svg {...common} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg>;
    case "results":
      return <svg {...common} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case "documents":
      return <svg {...common} className={className}><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></svg>;
    case "notifications":
      return <svg {...common} className={className}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
    case "profile":
      return <svg {...common} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "school":
      return <svg {...common} className={className}><path d="m3 9 9-5 9 5-9 5z" /><path d="M7 12v5c3 2 7 2 10 0v-5M21 10v6" /></svg>;
    case "calendar":
      return <svg {...common} className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
    case "clock":
      return <svg {...common} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "arrow":
      return <svg {...common} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    default:
      return null;
  }
}
