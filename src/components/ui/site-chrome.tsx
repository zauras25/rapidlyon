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

  return (
    <div className={`site-chrome flex min-h-dvh flex-col${isHomePage ? " site-chrome-home" : ""}`}>
      {!isClientWorkspace && header}
      <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
        {children}
      </main>
      {!isClientWorkspace && footer}
    </div>
  );
}
