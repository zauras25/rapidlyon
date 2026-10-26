import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { services } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/page-hero";

export const metadata = createPageMetadata(
  "Product Design, Next.js Development, and SEO",
  "Three connected capabilities for shaping, building, and improving digital products: Product Design, Next.js Development, and SEO.",
  "/services",
);

export default function ServicesPage() {
  return (
    <div className="rp-page rp-services bg-paper">
      <PageHero
        tone="dark"
        eyebrow="Three connected capabilities"
        title="Design the experience. Build it well. Make it discoverable."
        description="Rapidlyon brings Product Design, Next.js Development, and SEO together across the work of creating and improving digital products and websites."
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/discovery" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-bright">
            Start with Discovery <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-full border border-on-dark/25 px-5 py-3 text-sm font-medium text-on-dark transition hover:border-on-dark/60">
            View project options
          </Link>
        </div>
        <ol aria-label="How the services connect" className="mt-16 grid border-t border-on-dark/15 sm:grid-cols-3">
          {services.map((service, index) => (
            <li key={service.slug} className="flex items-center gap-4 border-b border-on-dark/15 py-5 last:border-b-0 sm:border-b-0 sm:py-6 sm:first:pl-0 sm:last:pr-0 sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:pr-5 sm:[&:not(:first-child)]:pl-5">
              <span className="text-xs font-medium text-accent">0{index + 1}</span>
              <Link className="text-base font-semibold text-on-dark hover:text-accent" href={`/services/${service.slug}`}>
                {service.title}
              </Link>
              {index < services.length - 1 ? <ArrowDown className="ml-auto size-4 text-on-dark/45 sm:hidden" aria-hidden="true" /> : null}
              {index < services.length - 1 ? <ArrowRight className="ml-auto hidden size-4 text-on-dark/45 sm:block" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </PageHero>

      <section aria-label="Core services" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {services.map((service, index) => (
          <article id={service.slug} key={service.slug} className="ds-services-list-item first:pt-12 last:border-b-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-accent-deep">0{index + 1} · {service.eyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">
                <Link href={`/services/${service.slug}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-deep">
                  {service.title}
                </Link>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-body">{service.short}</p>
              <Link href={`/services/${service.slug}`} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline decoration-divider-strong underline-offset-4 hover:decoration-ink">
                Explore {service.title} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {service.capabilities.map((group) => (
                <div key={group.group}>
                  <h3 className="text-xs font-semibold uppercase tracking-label-wide text-muted">{group.group}</h3>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <li key={item} className="border-t border-divider py-3 text-sm leading-6 text-body-strong">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="border-t border-divider pt-4 sm:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-label-wide text-muted">Typical outputs, agreed for the project</h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {service.deliverables.map((deliverable) => (
                    <li key={deliverable} className="text-sm leading-6 text-body">{deliverable}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="border-y border-divider-strong bg-surface px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.7fr_1.3fr] md:gap-14">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-accent-deep">One shared approach</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">A connected path from idea to improvement.</h2>
          </div>
          <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {services[0].process.map((step, index) => (
              <li key={step.title} className="border-t border-divider-strong py-4 sm:px-4 sm:first:pl-0 lg:border-l lg:border-t-0 lg:py-0 lg:first:border-l-0">
                <p className="text-xs font-semibold uppercase tracking-label-wide text-accent-deep">0{index + 1}</p>
                <h3 className="mt-2 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-body-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-6 bg-ink p-7 text-paper sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-accent">Start with the problem</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-display-tight sm:text-4xl">Not sure which capability your project needs?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-on-dark/75">Share what you are trying to make or improve. We can discuss a suitable scope before any work is agreed.</p>
          </div>
          <Link href="/discovery" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-bright">
            Start project Discovery <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
