import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { faqs, featuredProjects, insights, services } from "@/data/site";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata(
  "Product design, Next.js development, and SEO studio",
  "Rapidlyon brings product design, Next.js development, and SEO together to help teams create clear, capable digital products and websites.",
  "/",
);

const coreServiceDefinitions = [
  { slug: "ux-ui-design", title: "Product Design", number: "01" },
  { slug: "nextjs-development", title: "Next.js Development", number: "02" },
  { slug: "seo-website-optimization", title: "SEO", number: "03" },
] as const;

const coreServices = coreServiceDefinitions.flatMap((definition) => {
  const service = services.find((item) => item.slug === definition.slug);
  return service ? [{ ...definition, description: service.short }] : [];
});

const homepageFaqs = faqs.slice(0, 5);

const project = featuredProjects.find(
  (item) => item.slug === "umer-mobile-parts" && item.status === "published",
);

const process = [
  {
    title: "Discover",
    text: "Understand the audience, problem, goals, and constraints before choosing a direction.",
  },
  {
    title: "Scope & agree",
    text: "Confirm the deliverables, assumptions, timing, and fee in writing before work begins.",
  },
  {
    title: "Design & deliver",
    text: "Work through the agreed design, development, or optimization scope with visible decisions.",
  },
  {
    title: "Review & hand off",
    text: "Review the work against the agreed scope, complete launch tasks, and hand over deliverables.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-paper">
      <section className="hero-v9 bg-ink text-paper">
        <div className="ds-shell hero-v9-shell">
          <div className="hero-v9-topline">
            <p className="ds-eyebrow !text-accent">Independent digital product studio · Remote-first</p>
            <p className="hero-v9-index">01 / 03</p>
          </div>

          <div className="hero-v9-main">
            <div className="hero-v9-copy">
              <h1 className="hero-v9-title">
                We make complex digital ideas <span>clear.</span>
              </h1>
              <p className="hero-v9-lede">
                Product design, Next.js development, and SEO for founders and teams who need a digital experience that feels considered, works properly, and earns trust.
              </p>
              <div className="hero-v9-actions">
                <ButtonLink href="/discovery" className="!border-accent !bg-accent !text-ink hover:!border-accent-bright hover:!bg-accent-bright">
                  Start a Project <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
                <Link href="/work" className="hero-v9-text-link">
                  See selected work <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="hero-v9-system" aria-label="Rapidlyon service system">
              <div className="hero-v9-system-head">
                <span>Built around the whole experience</span>
                <span className="hero-v9-live"><i aria-hidden="true" /> Available for selected projects</span>
              </div>
              <div className="hero-v9-system-grid">
                {coreServices.map((service) => (
                  <Link key={service.slug} href={`/services/${service.slug}`} className="hero-v9-service group">
                    <span className="hero-v9-service-number">{service.number}</span>
                    <span className="hero-v9-service-title">{service.title}</span>
                    <ArrowUpRight size={18} aria-hidden="true" className="transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                    <span className="hero-v9-service-line" />
                  </Link>
                ))}
              </div>
              <p className="hero-v9-system-note">One specialist or the connected system - scoped around the problem, not a preset package.</p>
            </div>
          </div>

          <div className="hero-v9-foot">
            <span>Product thinking</span><span>Interface craft</span><span>Technical delivery</span><span>Search visibility</span>
          </div>
        </div>
      </section>

<section className="ds-section-tight" aria-label="Proof">
  <div className="ds-shell">
    <div className="grid border-y border-ink/15 md:grid-cols-4">
      <div className="border-b border-ink/15 px-0 py-5 md:border-b-0 md:border-r md:px-6 md:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body-muted">
          Clear thinking
        </p>
        <p className="mt-2 text-sm leading-6 text-body">
          Strategy before execution.
        </p>
      </div>

      <div className="border-b border-ink/15 px-0 py-5 md:border-b-0 md:border-r md:px-6 md:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body-muted">
          Focused delivery
        </p>
        <p className="mt-2 text-sm leading-6 text-body">
          Design and development working together.
        </p>
      </div>

      <div className="border-b border-ink/15 px-0 py-5 md:border-b-0 md:border-r md:px-6 md:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body-muted">
          Built to last
        </p>
        <p className="mt-2 text-sm leading-6 text-body">
          Systems that stay useful after launch.
        </p>
      </div>

      <div className="px-0 py-5 md:px-6 md:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body-muted">
          Human collaboration
        </p>
        <p className="mt-2 text-sm leading-6 text-body">
          One specialist or a connected team.
        </p>
      </div>
    </div>
  </div>
</section>


      {project ? (
        <section
          id="work"
          aria-labelledby="work-heading"
          className="ds-shell ds-section work-v9-section"
        >
          <div className="flex flex-col gap-6 border-b border-divider-strong pb-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              id="work-heading"
              eyebrow="Selected work - real project"
              title="A live project, explained honestly."
              description="One published project, with its context and visible experience-not invented results."
              className="max-w-2xl"
            />
            <Link
              href="/work"
              className="inline-flex shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
            >
              View all work <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <article className="work-v9-feature">
            <div className="work-v9-copy">
              <p className="text-xs font-medium uppercase tracking-label-tight text-muted">
                {project.visibilityLabel} - {project.projectType}
              </p>
              <h2
                id="umer-project-heading"
                className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-display-tight text-ink sm:text-5xl"
              >
                {project.title}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-body">
                {project.summary}
              </p>
              <p className="mt-4 max-w-xl text-sm leading-6 text-body-muted">
                {project.evidenceNote}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.services.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-divider-strong px-3 py-1.5 text-xs font-medium text-body-strong"
                  >
                    {service}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                <Link
                  href={`/work/${project.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
                >
                  Read the case study <ArrowRight size={16} aria-hidden="true" />
                </Link>
                {project.liveUrl ? (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
                  >
                    Visit the live storefront
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="work-v9-art">
              <div className="work-v9-orbit" aria-hidden="true" />
              <div className="flex items-start justify-between gap-4 border-b border-on-dark/15 pb-5">
                <p className="text-xs font-medium uppercase tracking-label-tight text-on-dark/60">
                  Storefront overview
                </p>
                <span className="rounded-full border border-on-dark/20 px-3 py-1.5 text-xs text-on-dark/75">
                  Live
                </span>
              </div>
              <div className="py-10">
                <p className="work-v9-art-title">
                  Find the right
                  <br />
                  mobile part.
                </p>
                <p className="mt-5 max-w-lg text-sm leading-7 text-on-dark/65">
                  Project objective: {project.objective}
                </p>
              </div>
              <p className="border-t border-on-dark/15 pt-4 text-sm leading-6 text-on-dark/50">
                Editorial project summary - not a storefront screenshot
              </p>
            </div>
          </article>
        </section>
      ) : null}

      <section
        id="services"
        aria-labelledby="services-heading"
        className="services-v9 border-y border-divider bg-surface"
      >
        <div className="ds-shell ds-section">
          <SectionHeading
            id="services-heading"
            eyebrow="What we do"
            title="Three disciplines. One considered digital experience."
            description="Bring in a focused capability or connect the work across product decisions, implementation, and discoverability."
          />
          <ol className="mt-10 divide-y divide-divider-strong border-y border-divider-strong">
            {coreServices.map((service) => (
              <li key={service.slug}>
                <article className="service-v9-row">
                  <span className="pt-1 text-xs font-medium tracking-label-compact text-accent-deep">
                    {service.number}
                  </span>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-display-tight text-ink sm:text-3xl">
                      {service.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-body">
                      {service.description}
                    </p>
                  </div>
                  <Link
                    href={`/services/${service.slug}`}
                    aria-label={`Explore ${service.title}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep sm:mt-2"
                  >
                    Explore service <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="approach-heading"
        className="mx-auto grid w-full max-w-[80rem] gap-8 px-4 ds-section sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-8"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-label-wide text-muted">
            A connected approach
          </p>
          <h2
            id="approach-heading"
            className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-display-tight text-ink sm:text-4xl"
          >
            Good digital work starts with the decisions behind it.
          </h2>
        </div>
        <div className="divide-y divide-divider-strong border-y border-divider-strong">
          {[
            {
              title: "Understand before recommending",
              text: "Start with the people, business goals, evidence, and constraints—not a predetermined solution.",
            },
            {
              title: "Connect design and engineering",
              text: "Shape the experience with implementation and handoff in mind, whether the work is focused or combined.",
            },
            {
              title: "Consider discoverability early",
              text: "Build technical SEO, content structure, and performance into the conversation instead of treating them as afterthoughts.",
            },
            {
              title: "Make scope and decisions visible",
              text: "Agree what is included, how feedback works, and what happens next before delivery begins.",
            },
          ].map((principle, index) => (
            <article key={principle.title} className="grid gap-3 py-5 sm:grid-cols-[2.5rem_1fr] sm:gap-5 lg:[&>div:last-child]:pr-2">
              <span className="text-xs font-medium tracking-label-compact text-accent-deep">
                0{index + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-display-tight text-ink">
                  {principle.title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-body">
                  {principle.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="fit-heading"
        className="border-b border-divider bg-paper"
      >
        <div className="ds-shell ds-section">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">
                Who we help
              </p>
              <h2
                id="fit-heading"
                className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-display-tight text-ink sm:text-4xl"
              >
                Digital work for teams that need clarity before scale.
              </h2>
            </div>
            <div className="divide-y divide-divider-strong border-y border-divider-strong">
              <article className="grid gap-3 py-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span className="text-xs font-medium tracking-label-compact text-accent-deep">01</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-display-tight text-ink">Founders</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-body">
                    Turn an idea, product, or early digital presence into something clear enough to build and useful enough to launch.
                  </p>
                </div>
              </article>
              <article className="grid gap-3 py-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span className="text-xs font-medium tracking-label-compact text-accent-deep">02</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-display-tight text-ink">Growing businesses</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-body">
                    Improve a website or digital experience that has outgrown its current structure, messaging, or implementation.
                  </p>
                </div>
              </article>
              <article className="grid gap-3 py-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span className="text-xs font-medium tracking-label-compact text-accent-deep">03</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-display-tight text-ink">Product teams</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-body">
                    Bring design, implementation, and discoverability together when the work needs more than one isolated capability.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="process-heading"
        className="process-v9 bg-ink text-paper"
      >
        <div className="ds-shell ds-section">
          <SectionHeading
            id="process-heading"
            eyebrow="How we work"
            title="A clear route from first question to handoff."
            description="The details vary by engagement, but the work moves through shared understanding, agreed scope, delivery, and review."
            tone="dark"
          />
          <ol className="mt-10 ds-grid-4 border-t border-on-dark/15 pt-7 lg:[&>article]:px-2">
            {process.map((step, index) => (
              <li key={step.title}>
                <p className="text-xs font-medium uppercase tracking-label-tight text-accent">
                  0{index + 1}
                </p>
                <h3 className="mt-4 text-xl font-semibold tracking-display-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-on-dark/70">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
          <Link
            href="/process"
            className="mt-9 inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-on-dark"
          >
            Read the full process <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>


      <section
        aria-labelledby="engagement-heading"
        className="ds-section-tight border-y border-divider bg-surface"
      >
        <div className="ds-shell">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">
                Engagement
              </p>
              <h2
                id="engagement-heading"
                className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-display-tight text-ink sm:text-4xl md:text-5xl"
              >
                Start with the scope you actually need.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-body">
                Some projects need one focused capability. Others benefit from
                design, development, and SEO working together. The engagement
                is shaped around the problem rather than forcing every project
                into the same package.
              </p>
            </div>

            <div className="self-end border-y border-divider-strong">
              <div className="grid gap-7 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-label-tight text-accent-deep">
                    Clear scope
                  </p>
                  <h3 className="mt-2 max-w-2xl text-xl font-semibold leading-snug tracking-display-tight text-ink sm:text-2xl">
                    See packages, pricing, and what is included.
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-body">
                    Review the available engagement options before deciding
                    whether Rapidlyon is the right fit.
                  </p>
                </div>

                <Link
                  href="/pricing"
                  className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
                >
                  View pricing <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <ReviewsSection displayOnly />


      {homepageFaqs.length > 0 ? (
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="ds-shell ds-section"
        >
          <div className="flex flex-col gap-5 border-b border-divider-strong pb-7 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              id="faq-heading"
              eyebrow="Common questions"
              title="Useful answers before you start."
              description="A few of the questions that usually come up around scope, collaboration, pricing, and delivery."
            />
            <Link
              href="/faq"
              className="inline-flex shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
            >
              View all FAQs <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-divider-strong border-b border-divider-strong">
            {homepageFaqs.map((faq, index) => (
              <article
                key={faq.question}
                className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr] sm:gap-6"
              >
                <span className="pt-1 text-xs font-medium tracking-label-compact text-muted">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold leading-snug tracking-display-tight text-ink">
                    {faq.question}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-body">
                    {faq.answer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {insights.length > 0 ? (
        <section
          id="insights"
          aria-labelledby="insights-heading"
          className="ds-shell ds-section"
        >
          <div className="flex flex-col gap-5 border-b border-divider-strong pb-7 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              id="insights-heading"
              eyebrow="Resources"
              title="Notes on making digital work clearer."
              description="Practical perspectives on product decisions, experience design, and useful websites."
            />
            <Link
              href="/insights"
              className="inline-flex shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
            >
              All resources <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-divider-strong">
            {insights.slice(0, 3).map((insight, index) => (
              <article
                key={insight.slug}
                className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-start sm:gap-6"
              >
                <span className="pt-1 text-xs font-medium tracking-label-compact text-muted">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-label-tight text-muted">
                    {insight.category} - {insight.readTime}
                  </p>
                  <h3 className="mt-2 max-w-3xl text-xl font-semibold leading-snug tracking-display-tight text-ink sm:text-2xl">
                    <Link
                      href={`/insights/${insight.slug}`}
                      className="transition-colors hover:text-accent-deep"
                    >
                      {insight.title}
                    </Link>
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-body">
                    {insight.excerpt}
                  </p>
                </div>
                <Link
                  href={`/insights/${insight.slug}`}
                  aria-label={`Read ${insight.title}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-accent-deep sm:mt-1"
                >
                  Read <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-divider bg-accent-soft">
        <div className="ds-shell ds-section-tight">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-accent-deep">
                Start with the problem
              </p>
              <h2 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-display-tight text-ink sm:text-4xl md:text-5xl">
                Have a product, website, or search problem worth solving?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-body">
                Share what you know so far. We will review the context and agree
                a sensible next step—an enquiry is not a commitment to start.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:min-w-48">
              <ButtonLink href="/discovery">
                Start project discovery <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/contact?intent=conversation" variant="secondary">
                Talk through an idea
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
