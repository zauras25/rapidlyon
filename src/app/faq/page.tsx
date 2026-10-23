import { PageHero } from "@/components/ui/page-hero";
import { faqs } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";
import { Plus } from "lucide-react";

export const metadata = createPageMetadata(
  "Frequently asked questions",
  "Answers about Rapidlyon discovery, project fit, written scope, timelines, collaboration, Product Design, Next.js Development, and SEO.",
  "/faq",
);

export default function FaqPage() {
  return (
    <div className="bg-paper">
      <PageHero eyebrow="FAQ" title="Answers to the most common questions." />
      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <div className="mt-2 space-y-4">
        {faqs.map((item) => (
          <details key={item.question} className="group rounded-panel border border-divider bg-surface transition-colors open:border-divider-strong">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-panel p-5 text-left marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-mid focus-visible:ring-offset-4 sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="text-lg font-medium tracking-display-tight text-ink sm:text-xl">{item.question}</span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-200 group-open:rotate-45">
                <Plus size={18} aria-hidden="true" />
              </span>
            </summary>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <p className="max-w-3xl border-t border-divider pt-4 text-sm leading-7 text-body sm:text-base">{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
      </div>
    </div>
  );
}
