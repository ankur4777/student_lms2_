import type { ReactNode } from "react";

import "./student-ui.css";

export default function StudentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="student-ui-scope">{children}</div>;
}
