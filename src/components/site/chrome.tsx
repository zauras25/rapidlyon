'use client';
import { EcosystemMarquee } from '@/components/site/ecosystem-marquee';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Image from 'next/image';
import { siteConfig } from '@/data/site';
import { AnimatedBrandMark } from '@/components/site/animated-brand-mark';

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return <Link className="brand" href="/" aria-label="RapidlyOn home" style={{ color: inverted ? 'white' : undefined }}>
    <span className="brand-mark"><AnimatedBrandMark /></span>
    <Image className="brand-wordmark" src="/brand/rapidlyon-wordmark.svg" alt="" aria-hidden={true} width={180} height={40} priority unoptimized />
  </Link>;
}
export function Header() {
  return <Suspense fallback={<HeaderContent pathname="" />}><HeaderPathname /></Suspense>;
}

function HeaderPathname() {
  const pathname = usePathname();
  return <HeaderContent pathname={pathname} />;
}

function HeaderContent({ pathname }: { pathname: string }) {
  // Menu state is tied to the route it was opened on, so navigating closes it
  // without remounting the header or setting state inside an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean) => setOpenPath(next ? pathname : null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { document.body.classList.toggle('mobile-nav-open', open); return () => document.body.classList.remove('mobile-nav-open'); }, [open]);
  useEffect(() => { if (!open) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenPath(null); menuButtonRef.current?.focus(); } }; document.addEventListener('keydown', closeOnEscape); return () => document.removeEventListener('keydown', closeOnEscape); }, [open]);
  return <header className="site-header"><div className="shell site-nav">
    <Brand />
    <nav className="nav-links" aria-label="Main navigation">
      {siteConfig.navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={'nav-link' + (pathname === item.href ? ' active' : '')}>{item.label}</Link>)}
    </nav>
    <div className="nav-actions"><Link href="/client/login" className="nav-link nav-user-link">Log in</Link><Link href="/client/sign-up" className="nav-link">Sign up</Link><Link href="/discovery" className="btn btn-dark btn-sm">Start a project <ArrowUpRight size={16}/></Link></div>
    <button ref={menuButtonRef} className="mobile-menu-button" aria-controls="rapidlyon-mobile-navigation" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={25} /> : <Menu size={25} />}</button>
  </div>
  <nav id="rapidlyon-mobile-navigation" className={'mobile-menu' + (open ? ' open' : '')} aria-label="Mobile navigation" inert={!open} aria-hidden={!open}>
    {siteConfig.navigation.map(item => <Link onClick={() => setOpen(false)} key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}
    <Link onClick={() => setOpen(false)} href="/client/login">Log in</Link>
    <Link onClick={() => setOpen(false)} href="/client/sign-up">Sign up</Link>
    <Link onClick={() => setOpen(false)} href="/discovery" className="btn btn-dark">Start a project <ArrowUpRight size={16}/></Link>
  </nav></header>;
}
// Brand icons are deliberately local SVG components. Lucide v1 does not
// provide brand-logo exports; this avoids breaking the Next.js build.
function LinkedinIcon({ size = 19, ...props }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M5.25 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM3.3 9h3.9v12H3.3V9Zm6.15 0h3.74v1.64h.05A4.1 4.1 0 0 1 16.92 8.7c3.94 0 4.68 2.45 4.68 5.63V21h-3.9v-5.92c0-1.41-.03-3.22-1.96-3.22-1.96 0-2.26 1.53-2.26 3.11V21h-3.9V9Z"/>
  </svg>;
}
function GithubIcon({ size = 19, ...props }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.89c-2.78.61-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.54 2.36 1.1 2.94.84.09-.65.35-1.1.64-1.35-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.8c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.69-4.57 4.94.36.31.68.91.68 1.84v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>
  </svg>;
}
// Lucide no longer ships the Dribbble brand glyph in the installed version.
// Render the familiar ball mark locally to avoid importing a nonexistent export.
function DribbbleIcon({ size = 19, ...props }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 3.9c4.1 4.8 6.7 9.7 8.2 16.4M4.4 6.5c4.4 3.5 9.3 4.2 15.5 2.9M3.2 13.8c5.2-3 10.7-3.4 17.3-.8" />
  </svg>;
}
function BehanceIcon({ size = 19, ...props }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 5h8.2c3.1 0 4.7 1.4 4.7 3.7 0 1.5-.8 2.6-2 3.1 1.9.4 3.1 1.8 3.1 3.8 0 2.8-2.1 4.4-5.3 4.4H3V5Zm3.2 2.6v3.2h4.4c1.3 0 2.1-.6 2.1-1.6 0-1.1-.7-1.6-2-1.6H6.2Zm0 5.7v4h4.9c1.5 0 2.4-.7 2.4-2s-.9-2-2.5-2H6.2ZM17 6.2h5v2h-5v-2Zm7 9.1h-7.7c.1 1.7 1 2.7 2.5 2.7 1 0 1.8-.5 2.1-1.3h3c-.6 2.4-2.5 3.7-5.2 3.7-3.4 0-5.5-2.2-5.5-5.6 0-3.3 2.1-5.6 5.5-5.6s5.4 2.3 5.4 5.8c0 .1 0 .2-.1.3Zm-7.6-1.9h4.5c-.2-1.3-1-2-2.2-2-1.2 0-2 .7-2.3 2Z" transform="translate(-1)" />
  </svg>;
}
// Only configured official profiles become clickable links. Never invent studio handles.
const socialProfiles = [
  { label: 'LinkedIn', href: process.env.NEXT_PUBLIC_LINKEDIN_URL || 'https://www.linkedin.com/in/zohaib-khan-36137b2ba', domain: 'linkedin.com', icon: LinkedinIcon },
  { label: 'GitHub', href: process.env.NEXT_PUBLIC_GITHUB_URL, domain: 'github.com', icon: GithubIcon },
  { label: 'Behance', href: process.env.NEXT_PUBLIC_BEHANCE_URL, domain: 'behance.net', icon: BehanceIcon },
  { label: 'Dribbble', href: process.env.NEXT_PUBLIC_DRIBBBLE_URL, domain: 'dribbble.com', icon: DribbbleIcon },
];
function SocialLinks() {
  const configuredProfiles = socialProfiles.filter(({ href, domain }) => {
    if (!href) return false;
    try {
      const url = new URL(href);
      return url.protocol === 'https:' &&
        (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) &&
        url.pathname !== '/';
    } catch {
      return false;
    }
  });
  if (!configuredProfiles.length) return null;

  return <nav className="footer-social" aria-label="Follow RapidlyOn">
    {configuredProfiles.map(({ label, href, icon: Icon }) =>
      <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`RapidlyOn on ${label}`} title={label}><Icon size={19} aria-hidden={true} /></a>
    )}
  </nav>;
}
const footerGroups = [
  { title:'Explore', items:[['About us','/about'],['Our process','/process'],['Our work','/work'],['Insights','/insights']] },
  { title:'Services', items:[['Product design','/services/ux-ui-design'],['Next.js development','/services/nextjs-development'],['SEO & optimization','/services/seo-website-optimization'],['Pricing','/pricing']] },
  { title:'Connect', items:[['Start a project','/discovery'],['Quick inquiry','/contact'],['Client workspace','/client/login'],['Frequently asked','/faq']] },
];
const COPYRIGHT_YEAR = new Date().getFullYear(); // evaluated once at build/start, not during render
function FooterCopyrightYear() {
  // The year changes infrequently. Allow the client to display its local year
  // without causing a hydration error near the New Year timezone boundary.
  return <span>{COPYRIGHT_YEAR}</span>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="shell">
      <div className="footer-top">
        <div className="footer-identity">
          <Brand inverted />
          <p>Product design, web development and SEO for meaningful digital experiences.</p>
          <a className="footer-email" href="mailto:hello@rapidlyon.com">hello@rapidlyon.com <ArrowUpRight size={17} aria-hidden={true} /></a>
          <SocialLinks />
        </div>
        {footerGroups.map(g => <nav className="footer-column" key={g.title} aria-label={`${g.title} footer links`}><h3>{g.title}</h3>{g.items.map(([name,url]) => <Link key={url} href={url}>{name}</Link>)}</nav>)}
      </div>
      <div className="footer-bottom">
        <span>© <FooterCopyrightYear /> RapidlyOn. Ideas to impact.</span>
        <div className="footer-legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><span>Designed with intention.</span></div>
      </div>
    </div>
  </footer>;
}
export function PublicShell({ children }: { children: React.ReactNode }) { return <><a className="skip-to-main" href="#main-content">Skip to main content</a><Header /><span id="main-content" tabIndex={-1} className="main-content-anchor" />{children}<EcosystemMarquee /><Footer /></>; }
