import type { ReactNode } from "react";

import "./parent-ui.css";

export default function ParentLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <div className="parent-ui-scope">{children}</div>;
}
