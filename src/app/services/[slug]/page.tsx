import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { featuredProjects, legacyServiceRedirects, services } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/page-hero";

export function generateStaticParams() {
  return [
    ...services.map((service) => ({ slug: service.slug })),
    ...Object.keys(legacyServiceRedirects).map((slug) => ({ slug })),
  ];
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const canonicalSlug = legacyServiceRedirects[slug] || slug;
    const service = services.find((item) => item.slug === canonicalSlug);

    if (!service) {
      return { title: "Service not found", robots: { index: false, follow: false } };
    }

    return createPageMetadata(
      service.title,
      `${service.short} Scope is agreed around your project and constraints.`,
      `/services/${canonicalSlug}`,
    );
  });
}

export default function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-16 text-sm text-body-muted sm:px-6 lg:px-8" role="status">Loading service information...</p>}>
      <ServiceDetailContent params={params} />
    </Suspense>
  );
}

async function ServiceDetailContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const canonicalSlug = legacyServiceRedirects[slug];

  if (canonicalSlug) {
    redirect(`/services/${canonicalSlug}`);
  }

  const service = services.find((item) => item.slug === slug);
  if (!service) {
    notFound();
  }

  const relatedProjects = featuredProjects.filter(
    (project) => project.status === "published" && service.relatedProjectSlugs?.includes(project.slug),
  );

  return (
    <article className="bg-paper">
      <PageHero
        tone="dark"
        eyebrow="Rapidlyon · Core service"
        title={service.title}
        description={service.short}
      >
        <p className="mt-4 max-w-3xl text-base leading-7 text-on-dark/65">{service.description}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/discovery" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-bright">
            Start with Discovery <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/services" className="inline-flex min-h-12 items-center justify-center rounded-full border border-on-dark/25 px-5 py-3 text-sm font-medium text-on-dark transition hover:border-on-dark/65">
            All three services
          </Link>
        </div>
      </PageHero>

      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <section aria-labelledby="solves-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">01 · What this solves</p>
            <h2 id="solves-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">The problems this work can help address.</h2>
          </div>
          <div>
            <p className="max-w-2xl text-base leading-7 text-body">{service.audience}</p>
            <ul className="mt-6 divide-y divide-divider-strong border-y border-divider-strong">
              {service.problems.map((problem) => (
                <li key={problem} className="py-4 text-sm leading-7 text-body-strong">{problem}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="capabilities-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">02 · Capabilities</p>
            <h2 id="capabilities-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">What we can help with.</h2>
          </div>
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {service.capabilities.map((group) => (
              <div key={group.group}>
                <h3 className="text-sm font-semibold text-ink">{group.group}</h3>
                <ul className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="border-t border-divider pt-2 text-sm leading-6 text-body">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="deliverables-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">03 · Deliverables</p>
            <h2 id="deliverables-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">Concrete outputs, scoped together.</h2>
          </div>
          <div>
            <p className="max-w-2xl text-sm leading-7 text-body-muted">The final outputs depend on project goals, available material, and agreed scope. These are examples of work that may be included.</p>
            <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {service.deliverables.map((deliverable) => (
                <li key={deliverable} className="border-t border-divider-strong py-3 text-sm leading-6 text-body-strong">{deliverable}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="process-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">04 · Shared process</p>
            <h2 id="process-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">One connected way of working.</h2>
          </div>
          <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {service.process.map((step, index) => (
              <li key={step.title} className="border-t border-divider-strong py-4 sm:px-4 sm:first:pl-0 lg:border-l lg:border-t-0 lg:py-0 lg:first:border-l-0">
                <p className="text-xs font-semibold uppercase tracking-label-wide text-accent-deep">0{index + 1}</p>
                <h3 className="mt-2 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-body-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="relationship-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">05 · Working relationship</p>
            <h2 id="relationship-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">Clear scope. Visible decisions.</h2>
          </div>
          <div>
            <p className="max-w-3xl text-base leading-7 text-body-strong">
              Before work begins, Rapidlyon confirms the objective, deliverables, exclusions, assumptions, milestones, estimated timing, fee, review points, and responsibilities in writing. Work proceeds against that agreed scope; changes are reviewed before they are made.
            </p>
            <Link href="/process" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent-deep">
              Read about the project process <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {relatedProjects.length ? (
          <section aria-labelledby="related-work-heading" className="ds-service-section">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Related work</p>
              <h2 id="related-work-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">A relevant concept study.</h2>
            </div>
            <ul className="divide-y divide-divider-strong border-y border-divider-strong">
              {relatedProjects.map((project) => (
                <li key={project.slug} className="py-5">
                  <p className="text-xs font-semibold uppercase tracking-label-wide text-accent-deep">
                    {project.projectContext === "concept" ? "Speculative concept · not client work" : project.projectContext === "personal" ? "Personal project" : "Client project"}
                  </p>
                  <Link href={`/work/${project.slug}`} className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-ink underline decoration-divider-strong underline-offset-4 hover:decoration-ink">
                    {project.title} <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-body-muted">{project.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="faq-heading" className="ds-service-section">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">06 · FAQ</p>
            <h2 id="faq-heading" className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">A few useful details.</h2>
          </div>
          <div className="divide-y divide-divider-strong border-y border-divider-strong">
            {service.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer rounded-sm text-base font-semibold text-ink marker:text-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-deep">
                  {faq.question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-body">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="grid gap-8 bg-ink px-6 py-10 text-paper sm:px-8 sm:py-12 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-accent">Next step</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-display-tight sm:text-4xl">Let’s work out what your project needs.</h2>
            <div className="mt-5 flex flex-wrap gap-5 text-sm font-medium">
              <Link href="/work" className="text-on-dark/75 underline underline-offset-4 hover:text-on-dark">Browse Work</Link>
              <Link href="/pricing" className="text-on-dark/75 underline underline-offset-4 hover:text-on-dark">View project options</Link>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:min-w-56">
            <Link href="/discovery" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-bright">
              Start with Discovery <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={`/contact?intent=service&service=${service.slug}`} className="inline-flex min-h-12 items-center justify-center rounded-full border border-on-dark/25 px-5 py-3 text-sm font-medium text-on-dark transition hover:border-on-dark/65">
              Ask about {service.title}
            </Link>
          </div>
        </footer>
      </div>
    </article>
  );
}
