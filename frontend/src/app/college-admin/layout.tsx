import type { ReactNode } from "react";

import "./college-admin-ui.css";

export default function CollegeAdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="college-admin-ui-scope">{children}</div>;
}
