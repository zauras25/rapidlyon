import { PageHero } from "@/components/ui/page-hero";
import { ProcessStepIcon } from "@/components/ui/process-step-icon";
import { processSteps } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Process",
  "See how Rapidlyon moves from discovery and project qualification to written scope, proposal, agreement, delivery, approval, and launch.",
  "/process",
);

export default function ProcessPage() {
  return (
    <div className="bg-paper">
      <PageHero
        eyebrow="How we work"
        title="Understand first. Agree the work. Then deliver."
        description="The path starts with your audience, problem, business model, goals, and constraints. A discovery request is a lead, not an accepted project or binding quote."
      />
      <div className="ds-shell pb-20 sm:pb-24">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {processSteps.map((step, index) => (
          <div key={step.title} className="rounded-panel border border-divider bg-surface p-6 shadow-soft-raised">
            <div className="mb-6 flex items-center justify-between text-caption uppercase tracking-label text-muted">
              <span>0{index + 1}</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-ink">
                <ProcessStepIcon title={step.title} />
              </span>
            </div>
            <h2 className="text-2xl tracking-display text-ink">{step.title}</h2>
            <p className="mt-4 text-sm leading-7 text-body">{step.text}</p>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
