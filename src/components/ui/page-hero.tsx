import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: "light" | "dark";
};

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  tone = "light",
}: PageHeroProps) {
  const dark = tone === "dark";

  return (
    <section className={dark ? "overflow-hidden bg-ink text-paper" : "bg-paper"}>
      <div className="ds-shell page-hero">
        <div className="page-hero-copy">
          <p className={dark ? "ds-eyebrow text-accent" : "ds-eyebrow"}>{eyebrow}</p>
          <h1 className={dark ? "ds-page-title mt-5 max-w-5xl text-paper" : "ds-page-title mt-5 max-w-5xl text-ink"}>
            {title}
          </h1>
          {description ? (
            <p className={dark ? "mt-6 max-w-2xl text-base leading-8 text-paper/70 sm:text-lg" : "mt-6 max-w-2xl text-base leading-8 text-body sm:text-lg"}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
