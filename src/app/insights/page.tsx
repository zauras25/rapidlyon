import Link from "next/link";
import { insights } from "@/data/site";
import { PageHero } from "@/components/ui/page-hero";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Resources",
  "Practical articles on digital design, product decisions, user experience and building useful websites.",
  "/insights",
);

export default function InsightsPage() {
  return (
    <div className="bg-paper">
      <PageHero
        eyebrow="Resources"
        title="Practical notes on design, product decisions, and digital clarity."
        description="Short, distinct perspectives on reducing user friction, communicating an offer, and deciding what an MVP needs to test."
      />
      <div className="ds-shell ds-section-tight">
      <div className="grid gap-4 lg:grid-cols-2">
        {insights.map((item) => (
          <Link key={item.slug} href={`/insights/${item.slug}`} className="surface-interactive block rounded-panel border border-divider bg-surface p-6 shadow-soft">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-label text-muted">{item.category}</p>
                <h2 className="mt-3 text-2xl tracking-display text-ink">{item.title}</h2>
              </div>
              <p className="text-sm text-body">{item.readTime}</p>
            </div>
            <p className="mt-4 text-base leading-8 text-body">{item.excerpt}</p>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
