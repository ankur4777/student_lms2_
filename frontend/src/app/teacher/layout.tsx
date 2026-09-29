import type { ReactNode } from "react";

import "./teacher-ui.css";

export default function TeacherLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="teacher-ui-scope">{children}</div>;
}
