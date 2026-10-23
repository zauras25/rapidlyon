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
    <section className={dark ? "bg-ink text-paper" : "bg-paper"}>
      <div className="ds-shell page-hero">
        <div className="page-hero-copy">
          <p className={dark ? "ds-eyebrow text-accent" : "ds-eyebrow"}>{eyebrow}</p>
          <h1 className={dark ? "ds-page-title mt-4 max-w-5xl text-paper sm:mt-5" : "ds-page-title mt-4 max-w-5xl text-ink sm:mt-5"}>
            {title}
          </h1>
          {description ? (
            <p className={dark ? "mt-5 max-w-2xl text-base leading-7 text-paper/75 sm:text-lg sm:leading-8" : "mt-5 max-w-2xl text-base leading-7 text-body sm:text-lg sm:leading-8"}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
