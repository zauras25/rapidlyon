import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { featuredProjects, insights, services } from "@/data/site";
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

const project = featuredProjects.find(
  (item) => item.slug === "umer-mobile-parts" && item.status === "published",
);

const homepageInsights = insights.slice(0, 3);

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
    <div className="rp-page rp-home bg-paper">
      <section className="hero-v9 bg-ink text-paper">
        <div className="ds-shell hero-v9-shell">
          <div className="hero-v9-topline">
            <p className="ds-eyebrow !text-accent">Independent digital product studio</p>
            <p className="hero-v9-location">Remote-first <span aria-hidden="true">/</span> Working internationally</p>
          </div>

          <div className="hero-v9-main">
            <div className="hero-v9-copy">
              <h1 className="hero-v9-title">
                <span>Digital products,</span>
                <span className="hero-v9-title-accent">designed &amp; built.</span>
              </h1>
            </div>

            <div className="hero-v9-intro">
              <p className="hero-v9-lede">
                We bring product thinking, design craft, and engineering together to make useful digital experiences for serious businesses and teams.
              </p>
              <div className="hero-v9-actions">
                <ButtonLink href="/discovery" className="!border-accent !bg-accent !text-ink hover:!border-accent-bright hover:!bg-accent-bright">
                  Start a Project <ArrowRight size={16} aria-hidden="true" />
                </ButtonLink>
                <Link href="#work" className="hero-v9-text-link">
                  View a project <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <nav className="hero-v9-system" aria-label="Explore Rapidlyon services">
              <div className="hero-v9-system-head">
                <span>What we do</span>
                <span>01—03</span>
              </div>
              <div className="hero-v9-system-grid">
                {coreServices.map((service) => (
                  <Link key={service.slug} href={`/services/${service.slug}`} className="hero-v9-service group">
                    <span className="hero-v9-service-number">{service.number} <span aria-hidden="true">/</span></span>
                    <span className="hero-v9-service-title">{service.title}</span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </section>

      {project ? (
        <section
          id="work"
          aria-labelledby="work-heading"
          className="ds-shell ds-section work-v9-section"
        >
          <div className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              id="work-heading"
              eyebrow="Project evidence"
              title="Product thinking, applied to a live storefront."
              description="A deployed personal project, with its context and limitations stated clearly."
              className="max-w-2xl"
            />
          </div>

          <article className="work-v9-feature">
            <div className="work-v9-copy">
              <p className="text-xs font-medium uppercase tracking-label-tight text-muted">
                {project.visibilityLabel}
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
                During review, the live site showed a catalog-sync error and demo data. Catalog sync and order completion are not verified; no business or user outcomes are published.
              </p>
              <p className="mt-5 text-xs font-medium uppercase tracking-label-tight text-muted">
                Role · {project.role}
              </p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                <Link
                  href={`/work/${project.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
                >
                  View Case Study <ArrowRight size={16} aria-hidden="true" />
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

            <div className="work-v9-evidence">
              <div className="work-v9-evidence-head">
                <p className="text-xs font-medium uppercase tracking-label-tight text-on-dark/60">
                  Observed in the public interface
                </p>
                <span>PRODUCT PATHWAYS</span>
              </div>
              <ol className="work-v9-evidence-list">
                {project.observedJourneys.slice(0, 3).map((journey, index) => (
                  <li key={journey}>
                    <span className="work-v9-evidence-number">0{index + 1}</span>
                    <p>{journey}</p>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </li>
                ))}
              </ol>
              <p className="work-v9-evidence-note">
                Interface observations, not measured outcomes. This is a personal project, not client work.
              </p>
            </div>
          </article>
        </section>
      ) : null}

      <section
        id="services"
        aria-labelledby="services-heading"
        className="services-v9 bg-surface"
      >
        <div className="ds-shell ds-section services-v9-layout">
          <SectionHeading
            id="services-heading"
            eyebrow="Studio disciplines"
            title="The right work, at the right layer."
            description="Choose a focused capability or connect the disciplines around the problem."
            className="services-v9-intro"
          />
          <ol className="services-v9-list">
            {coreServices.map((service) => (
              <li key={service.slug}>
                <article className="service-v9-row">
                  <span className="service-v9-number" aria-hidden="true">{service.number}</span>
                  <div>
                    <h3 className="service-v9-title">
                      {service.title}
                    </h3>
                    <p className="service-v9-description">
                      {service.description}
                    </p>
                  </div>
                  <Link
                    href={`/services/${service.slug}`}
                    aria-label={`Explore ${service.title}`}
                    className="service-v9-link"
                  >
                    <span>Explore service</span><ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              </li>
            ))}
          </ol>
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
          <ol className="process-v9-steps">
            {process.map((step, index) => (
              <li key={step.title}>
                <p className="process-v9-index">
                  <span>0{index + 1}</span><span className="process-v9-stage">STAGE</span>
                </p>
                <h3 className="process-v9-title">
                  {step.title}
                </h3>
                <p className="process-v9-description">
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


      <ReviewsSection displayOnly />


      {homepageInsights.length > 0 ? (
        <section
          id="insights"
          aria-labelledby="insights-heading"
          className="resources-v9"
        >
          <div className="ds-shell ds-section">
            <div className="resources-v9-heading">
              <SectionHeading
                id="insights-heading"
                eyebrow="Resources"
                title="Ideas for clearer digital work."
                description="Practical reading on product decisions, experience design, and useful websites."
              />
              <Link
                href="/insights"
                className="resources-v9-all"
              >
                All resources <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="resources-v9-grid">
              {homepageInsights[0] ? (
                <article className="resource-v9-featured">
                  <p className="resource-v9-meta">
                    <span>01</span>{homepageInsights[0].category} <span aria-hidden="true">/</span> {homepageInsights[0].readTime}
                  </p>
                  <h3 className="resource-v9-title">
                    <Link href={`/insights/${homepageInsights[0].slug}`}>
                      {homepageInsights[0].title}
                    </Link>
                  </h3>
                  <p className="resource-v9-excerpt">{homepageInsights[0].excerpt}</p>
                  <Link
                    href={`/insights/${homepageInsights[0].slug}`}
                    aria-label={`Read ${homepageInsights[0].title}`}
                    className="resource-v9-link"
                  >
                    Read article <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              ) : null}
              <div className="resource-v9-list">
                {homepageInsights.slice(1).map((insight, index) => (
                  <article key={insight.slug} className="resource-v9-item">
                    <p className="resource-v9-meta">
                      <span>0{index + 2}</span>{insight.category} <span aria-hidden="true">/</span> {insight.readTime}
                    </p>
                    <h3 className="resource-v9-title">
                      <Link href={`/insights/${insight.slug}`}>
                        {insight.title}
                      </Link>
                    </h3>
                    <p className="resource-v9-excerpt">{insight.excerpt}</p>
                    <Link
                      href={`/insights/${insight.slug}`}
                      aria-label={`Read ${insight.title}`}
                      className="resource-v9-link"
                    >
                      Read article <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="final-cta-v9">
        <div className="ds-shell ds-section-tight">
          <div className="final-cta-v9-layout">
            <div>
              <p className="final-cta-v9-eyebrow">
                A good place to begin
              </p>
              <h2 className="final-cta-v9-title">
                Tell us what you are working on.
              </h2>
              <p className="final-cta-v9-copy">
                Use the project discovery form to share your goals and scope. It starts a conversation, not a commitment to work together.
              </p>
            </div>

            <div className="final-cta-v9-action">
              <ButtonLink href="/discovery">
                Start a Project <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
