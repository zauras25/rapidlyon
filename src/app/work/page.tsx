import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/ui/page-hero";
import { WorkPortfolio } from "@/components/work/work-portfolio";
import { createPageMetadata } from "@/lib/metadata";
import { getPublishedWorkProjects } from "@/lib/work-project-storage";
import { Suspense } from "react";

export const metadata = createPageMetadata(
  "Selected digital product work",
  "Explore real projects and clearly labeled concept studies, with project context, decisions, and evidence presented honestly.",
  "/work",
);

export default function WorkPage() {
  return (
    <div className="bg-paper">
      <PageHero
        tone="dark"
        eyebrow="Selected work · project context"
        title="Work, with its context intact."
        description="Explore real projects and explicitly labeled concepts. Each story focuses on what the work involved and what can genuinely be shown."
      >
        <div className="mt-10 grid gap-5 border-t border-on-dark/15 pt-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-label-tight text-accent">A note on proof</p>
            <p className="mt-3 text-sm leading-7 text-on-dark/70">Personal work and speculative concepts are not described as client engagements. Results appear only when supported by real evidence.</p>
          </div>
          <Link href="/contact?intent=conversation" className="inline-flex items-center gap-2 text-sm font-medium text-on-dark underline decoration-white/30 underline-offset-4 hover:decoration-white">
            Discuss a project <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </PageHero>

      <section className="ds-shell ds-section">
        <Suspense fallback={<p className="py-10 text-sm text-body-muted" role="status">Loading projects…</p>}>
          <PublishedWorkPortfolio />
        </Suspense>
      </section>

      <section className="border-t border-divider bg-surface">
        <div className="ds-shell flex flex-col gap-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Have a project to show?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-display-tight text-ink">Let’s make the next case study yours.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact?intent=conversation" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark hover:bg-ink-hover">
              Start a conversation <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center rounded-full border border-black/15 px-5 py-3 text-sm font-medium text-ink hover:border-black/35">
              View project packages
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

async function PublishedWorkPortfolio() {
  return <WorkPortfolio projects={await getPublishedWorkProjects()} />;
}

