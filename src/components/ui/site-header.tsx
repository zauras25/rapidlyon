"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/data/site";
import { getSupabaseClient } from "@/lib/supabase";

function getFirstName(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.first_name, metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return name?.trim().split(/\s+/)[0] || "Account";
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [accountError, setAccountError] = useState(false);
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void Promise.resolve()
      .then(() => getSupabaseClient())
      .then((supabase) => {
        if (!active) return;
        const applyUser = (user: { email?: string; user_metadata?: Record<string, unknown> } | null) => {
          if (!active) return;
          setFirstName(user ? getFirstName(user) : "");
          setAccountError(false);
        };
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          applyUser(session?.user ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setAccountError(true);
            return;
          }
          applyUser(data.session?.user ?? null);
        });
      })
      .catch(() => {
        if (active) setAccountError(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function signOut() {
    setAccountOpen(false);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        setAccountError(true);
        setAccountOpen(true);
      }
    } catch {
      setAccountError(true);
      setAccountOpen(true);
    }
  }

  return (
    <header className="site-header-v9 sticky top-0 z-50">
      <div className="ds-shell site-header-v9-inner flex min-h-18 items-center justify-between gap-4 py-3 sm:gap-6">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className="site-header-v9-brand shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-deep"
        >
          <Image
            src="/brand/rapidlyon-uploaded-logo.svg"
            alt={siteConfig.brand}
            width={1400}
            height={450}
            priority
            className="ds-logo"
          />
        </Link>

        <nav aria-label="Main navigation" className="site-header-v9-nav hidden items-center min-[75rem]:flex">
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "page"
                  : undefined
              }
              className="nav-link site-header-v9-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 min-[75rem]:block site-header-v9-actions">
          <div className="flex items-center gap-4">
            {firstName ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  aria-expanded={accountOpen}
                  aria-controls="site-account-menu"
                  onClick={() => setAccountOpen((value) => !value)}
                  className="site-header-v9-account inline-flex items-center gap-1 text-base font-semibold text-ink/72 transition-colors hover:text-ink"
                >
                  {firstName}
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <div id="site-account-menu" hidden={!accountOpen} className="absolute right-0 top-full z-50 mt-3 min-w-48 rounded-2xl border border-divider bg-surface p-2 shadow-elevated">
                  {accountError ? <p role="alert" className="px-3 py-2 text-xs text-danger-strong">Account access could not be verified.</p> : null}
                  <Link href="/client" onClick={() => setAccountOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-paper">
                    My Projects
                  </Link>
                  <button type="button" onClick={signOut} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-paper">
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/client/login"
                title={accountError ? "Account status could not be checked. Sign in to continue." : undefined}
                className="site-header-v9-account text-base font-semibold text-ink/72 transition-colors hover:text-ink"
              >
                {accountError ? "Log in" : "Register / Log in"}
              </Link>
            )}
            {accountError && !firstName ? <span role="status" className="sr-only">Account status could not be checked. Sign in to continue.</span> : null}
            <ButtonLink href="/discovery" className="px-5 py-2.5">
              Start a Project
            </ButtonLink>
          </div>
        </div>

        <button
          ref={mobileMenuButtonRef}
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-controls="mobile-navigation"
          aria-expanded={open}
          className="input-focus-ring inline-flex size-11 items-center justify-center rounded-control border border-divider-strong bg-surface-soft text-ink transition-colors hover:bg-paper min-[75rem]:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        id="mobile-navigation"
        hidden={!open}
        className="border-t border-divider bg-paper min-[75rem]:hidden"
      >
        <nav
          aria-label="Mobile navigation"
          className="ds-shell flex flex-col gap-1 py-4 text-base font-medium text-ink"
        >
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "page"
                  : undefined
              }
              className="nav-link site-header-v9-link"
            >
              {item.label}
            </Link>
          ))}
          {firstName ? (
            <>
              <p className="px-4 text-base font-semibold text-ink">{firstName}</p>
              {accountError ? <p role="alert" className="px-4 text-sm text-danger-strong">Account access could not be verified.</p> : null}
              <Link href="/client" onClick={() => setOpen(false)} className="nav-link site-header-v9-link">
                My Projects
              </Link>
              <button type="button" onClick={signOut} className="nav-link site-header-v9-link text-left">
                Sign out
              </button>
            </>
          ) : (
            <>
              {accountError ? <p role="alert" className="px-4 text-sm text-danger-strong">Account status could not be checked.</p> : null}
              <Link href="/client/login" onClick={() => setOpen(false)} className="nav-link site-header-v9-link">
                {accountError ? "Log in" : "Register / Log in"}
              </Link>
            </>
          )}
          <ButtonLink
            href="/discovery"
            onClick={() => setOpen(false)}
            className="mt-2 w-full py-3"
          >
            Start a Project
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
