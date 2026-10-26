"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteChrome({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const isClientWorkspace = pathname === "/client" || pathname.startsWith("/client/");
  const isHomePage = pathname === "/";
  const isOperations = pathname.startsWith("/admin/") && !pathname.includes("/login");

  return (
    <div className={`site-chrome flex min-h-dvh flex-col${isHomePage ? " site-chrome-home" : ""}`}>
      {!isClientWorkspace && !isOperations && header}
      <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
        {children}
      </main>
      {!isClientWorkspace && !isOperations && footer}
    </div>
  );
}
