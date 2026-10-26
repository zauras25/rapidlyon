"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, FolderKanban, CreditCard, Star, ExternalLink, ArrowLeft, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

const navigation = [
  { href: "/admin/operations", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/discovery", label: "Discovery", Icon: Inbox },
  { href: "/admin/projects", label: "Projects", Icon: FolderKanban },
  { href: "/admin/billing", label: "Billing", Icon: CreditCard },
  { href: "/admin/reviews", label: "Reviews", Icon: Star },
];
export function StudioAdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title = navigation.find(item => pathname.startsWith(item.href))?.label ?? "Studio";
  return <div className="rp-admin-frame">
    <a className="rp-skip" href="#rp-admin-main">Skip to content</a>
    <button className="rp-admin-mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="rp-admin-sidebar"><Menu size={19}/> Studio menu</button>
    <aside id="rp-admin-sidebar" className={`rp-admin-sidebar ${open ? "is-open" : ""}`}>
      <Link href="/admin/operations" className="rp-admin-brand"><span className="rp-brand-mark">R</span><span>Rapidlyon<small>STUDIO OS</small></span></Link>
      <p className="rp-sidebar-label">WORKSPACE</p>
      <nav aria-label="Studio navigation">{navigation.map(({href,label,Icon})=><Link onClick={()=>setOpen(false)} aria-current={pathname.startsWith(href)?"page":undefined} href={href} key={href}><Icon size={17}/>{label}</Link>)}</nav>
      <div className="rp-sidebar-bottom"><span className="rp-status-dot"/> Studio workspace <Link href="/" target="_blank">Public website <ExternalLink size={13}/></Link></div>
    </aside>
    <div className="rp-admin-content"><header className="rp-admin-topbar"><div className="rp-admin-breadcrumb"><Link href="/admin/operations"><ArrowLeft size={15}/> Studio</Link><span>/</span><strong>{title}</strong></div><span className="rp-admin-topbar-tag">ADMIN WORKSPACE</span></header><main id="rp-admin-main" className="rp-admin-main">{children}</main></div>
  </div>;
}
