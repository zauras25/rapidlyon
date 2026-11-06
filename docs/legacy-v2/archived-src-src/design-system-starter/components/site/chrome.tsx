'use client';
import { EcosystemMarquee } from '@/components/site/ecosystem-marquee';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, UserRound, X } from 'lucide-react';
import { siteConfig } from '@/data/site';
import { AnimatedBrandMark } from '@/components/site/animated-brand-mark';

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return <Link className="brand" href="/" aria-label="RapidlyOn home" style={{ color: inverted ? 'white' : undefined }}>
    <span className="brand-mark"><AnimatedBrandMark /></span>
    <img className="brand-wordmark" src="/brand/rapidlyon-wordmark.svg" alt="" aria-hidden={true} />
  </Link>;
}
export function Header() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => { document.body.classList.toggle('mobile-nav-open', open); return () => document.body.classList.remove('mobile-nav-open'); }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (!open) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButtonRef.current?.focus(); } }; document.addEventListener('keydown', closeOnEscape); return () => document.removeEventListener('keydown', closeOnEscape); }, [open]);
  return <header className="site-header"><div className="shell site-nav">
    <Brand />
    <nav className="nav-links" aria-label="Main navigation">
      {siteConfig.navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={'nav-link' + (pathname === item.href ? ' active' : '')}>{item.label}</Link>)}
    </nav>
    <div className="nav-actions"><Link href="/discovery" className="btn btn-dark btn-sm">Start a project <ArrowUpRight size={16}/></Link><Link href="/client/login" className="nav-link nav-user-link" aria-label="Client sign in"><UserRound size={18} aria-hidden={true} />Client login</Link></div>
    <button ref={menuButtonRef} className="mobile-menu-button" aria-controls="rapidlyon-mobile-navigation" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={25} /> : <Menu size={25} />}</button>
  </div>
  <nav id="rapidlyon-mobile-navigation" className={'mobile-menu' + (open ? ' open' : '')} aria-label="Mobile navigation" inert={!open} aria-hidden={!open}>
    {siteConfig.navigation.map(item => <Link onClick={() => setOpen(false)} key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}
    <Link onClick={() => setOpen(false)} href="/discovery" className="btn btn-dark">Start a project <ArrowUpRight size={16}/></Link>
    <Link onClick={() => setOpen(false)} href="/client/login" className="nav-link nav-user-link"><UserRound size={18} aria-hidden={true} />Client login</Link>
  </nav></header>;
}
// Brand icons are deliberately local SVG components. Lucide v1 does not
// provide brand-logo exports; this avoids breaking the Next.js build.
function InstagramIcon({ size = 19, ...props }: { size?: number; 'aria-hidden'?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.8" cy="6.3" r="1" fill="currentColor" stroke="none"/>
  </svg>;
}
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
// Only configured official profiles become clickable links. Never invent studio handles.
const socialProfiles = [
  { label: 'Instagram', href: process.env.NEXT_PUBLIC_INSTAGRAM_URL, icon: InstagramIcon },
  { label: 'LinkedIn', href: process.env.NEXT_PUBLIC_LINKEDIN_URL, icon: LinkedinIcon },
  { label: 'Dribbble', href: process.env.NEXT_PUBLIC_DRIBBBLE_URL, icon: DribbbleIcon },
  { label: 'GitHub', href: process.env.NEXT_PUBLIC_GITHUB_URL, icon: GithubIcon },
];
function SocialLinks() {
  return <div className="footer-social" aria-label="RapidlyOn social profiles">
    {socialProfiles.map(({ label, href, icon: Icon }) => href?.startsWith('https://')
      ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`RapidlyOn on ${label}`} title={label}><Icon size={19} aria-hidden={true} /></a>
      : <span key={label} className="footer-social-unconfigured" title={`${label} profile not configured`} aria-label={`${label} profile not yet available`}><Icon size={19} aria-hidden={true} /></span>)}
  </div>;
}
const footerGroups = [
  { title:'Explore', items:[['About us','/about'],['Our process','/process'],['Our work','/work'],['Insights','/insights']] },
  { title:'Services', items:[['Product design','/services/ux-ui-design'],['Next.js development','/services/nextjs-development'],['SEO & optimization','/services/seo-website-optimization'],['Pricing','/pricing']] },
  { title:'Connect', items:[['Start a project','/discovery'],['Quick inquiry','/contact'],['Client workspace','/client/login'],['Frequently asked','/faq']] },
];
function FooterCopyrightYear() {
  // The year changes infrequently. Allow the client to display its local year
  // without causing a hydration error near the New Year timezone boundary.
  return <span suppressHydrationWarning>2026</span>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="shell">
      <section className="footer-impact" aria-labelledby="footer-impact-heading">
        <div className="footer-impact-copy">
          <p className="footer-impact-kicker"><span className="footer-impact-dot" aria-hidden={true} /> IDEAS TO IMPACT</p>
          <h2 id="footer-impact-heading">Good ideas deserve <span>real impact.</span></h2>
          <p className="footer-impact-description">Have an idea, a product to improve, or a business challenge to solve? Tell us what you have in mind. We'll help you explore the right next step.</p>
        </div>
        <div className="footer-impact-actions">
          <Link href="/discovery" className="btn footer-impact-primary">Start a project <ArrowUpRight size={19} aria-hidden={true} /></Link>
          <Link href="/contact" className="footer-impact-secondary">Just have a question? <ArrowUpRight size={17} aria-hidden={true} /></Link>
        </div>
      </section>
      <div className="footer-top">
        <div className="footer-identity">
          <Brand inverted />
          <p>Thoughtful design and development, from first conversation to meaningful digital experiences.</p>
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

