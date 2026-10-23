import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { featuredProjects } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";
import type { WorkProject } from "@/lib/work-project-schema";
import { getPublishedWorkProjects } from "@/lib/work-project-storage";

export function generateStaticParams() {
  return featuredProjects
    .filter((project) => project.status === "published")
    .map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = (await getPublishedWorkProjects()).find((item) => item.slug === slug);

    if (!project) {
      return { title: "Project not found", robots: { index: false, follow: false } };
    }

    return createPageMetadata(
      project.title,
      `${project.projectContext === "personal" ? "Personal project. " : ""}${project.summary}`,
      `/work/${slug}`,
    );
}

const uxStages: { key: keyof NonNullable<WorkProject["uxDesign"]>; title: string }[] = [
  { key: "discovery", title: "Discovery" },
  { key: "define", title: "Define" },
  { key: "sitemapAndIa", title: "Sitemap & information architecture" },
  { key: "wireframes", title: "Wireframes" },
  { key: "uiDesign", title: "UI design" },
  { key: "designAudit", title: "Design audit" },
  { key: "prototypeTesting", title: "Prototype testing" },
  { key: "developerHandoff", title: "Developer handoff" },
];

const developmentStages: { key: keyof NonNullable<WorkProject["development"]>; title: string }[] = [
  { key: "briefAndScope", title: "Brief & scope" },
  { key: "technicalApproach", title: "Technical approach" },
  { key: "implementation", title: "Implementation" },
  { key: "integrations", title: "Integrations" },
  { key: "qualityAssurance", title: "Quality assurance" },
  { key: "deploymentAndHandoff", title: "Deployment & handoff" },
];

const projectContextLabels: Record<WorkProject["projectContext"], string> = {
  client: "Client project",
  personal: "Personal project",
  concept: "Concept · speculative",
};

export default function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-16 text-sm text-body-muted sm:px-6 lg:px-8" role="status">Loading case study...</p>}>
      <WorkDetailContent params={params} />
    </Suspense>
  );
}

async function WorkDetailContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = (await getPublishedWorkProjects()).find((item) => item.slug === slug);

  if (!project) {
    notFound();
  }

  const uxStory = uxStages.flatMap(({ key, title }, index) => {
    const section = project.uxDesign?.[key];
    return section && (section.summary || section.points?.length || section.media?.length)
      ? [{ key, title, index, section }]
      : [];
  });
  const developmentStory = developmentStages.flatMap(({ key, title }, index) => {
    const section = project.development?.[key];
    return section && (section.summary || section.points?.length || section.media?.length)
      ? [{ key, title, index, section }]
      : [];
  });

  return (
    <article className="bg-paper">
      <header className="bg-ink px-4 pb-16 pt-8 text-paper sm:px-6 sm:pb-24 sm:pt-12 lg:px-8 lg:pt-14">
        <div className="mx-auto max-w-7xl">
          <Link href="/work" className="inline-flex items-center gap-2 text-sm font-medium text-on-dark/75 hover:text-on-dark">
            <ArrowLeft size={16} aria-hidden="true" /> All work
          </Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-end lg:gap-16">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 text-caption font-medium uppercase tracking-label-wide text-accent">
                <span>{projectContextLabels[project.projectContext]}</span>
                <span aria-hidden="true">·</span>
                <span>{project.visibilityLabel}</span>
              </div>
              <h1 className="ds-case-title mt-5 max-w-5xl">
                {project.title}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-on-dark/75 sm:text-lg sm:leading-8">{project.summary}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-ink hover:bg-accent-bright">
                    Visit the live website <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                ) : null}
                <Link href="#overview" className="inline-flex min-h-12 items-center justify-center rounded-full border border-on-dark/30 px-5 py-3 text-sm font-medium text-on-dark hover:border-on-dark/70">
                  Explore the case study
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6 border-t border-on-dark/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div>
                <dt className="text-caption uppercase tracking-label-compact text-on-dark/65">Project type</dt>
                <dd className="mt-2 text-sm leading-6">{project.projectType}</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-label-compact text-on-dark/65">Role</dt>
                <dd className="mt-2 text-sm leading-6">{project.role}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-caption uppercase tracking-label-compact text-on-dark/65">Services</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {project.services.map((service) => (
                    <span key={service} className="rounded-full border border-on-dark/20 px-3 py-1.5 text-xs text-on-dark/80">{service}</span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        {project.coverMedia ? (
          <figure className="ds-media-frame -mt-2 bg-navy">
            <div className="relative aspect-[16/8]">
              <Image
                src={project.coverMedia.src}
                alt={project.coverMedia.alt}
                fill
                priority
                unoptimized
                sizes="(max-width: 768px) 100vw, 1200px"
                className="object-cover"
              />
            </div>
            {project.coverMedia.caption ? (
              <figcaption className="bg-navy px-5 py-3 text-xs text-on-dark/60">{project.coverMedia.caption}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <nav aria-label="Case study sections" className="ds-case-nav mt-8 flex gap-7 overflow-x-auto border-b border-divider-strong pb-4 text-sm">
          <a href="#overview" className="shrink-0 font-medium text-body-strong hover:text-black">Overview</a>
          <a href="#context" className="shrink-0 font-medium text-body-strong hover:text-black">Challenge</a>
          {uxStory.length ? <a href="#ux-process" className="shrink-0 font-medium text-body-strong hover:text-black">UX process</a> : null}
          {developmentStory.length ? <a href="#development" className="shrink-0 font-medium text-body-strong hover:text-black">Development</a> : null}
          {project.observedJourneys.length ? <a href="#journey" className="shrink-0 font-medium text-body-strong hover:text-black">Product structure</a> : null}
          {project.seoEvidence ? <a href="#seo" className="shrink-0 font-medium text-body-strong hover:text-black">SEO</a> : null}
          {project.responsiveEvidence ? <a href="#responsive" className="shrink-0 font-medium text-body-strong hover:text-black">Responsive</a> : null}
          <a href="#evidence" className="shrink-0 font-medium text-body-strong hover:text-black">Evidence</a>
          {project.gallery.length ? <a href="#gallery" className="shrink-0 font-medium text-body-strong hover:text-black">Gallery</a> : null}
        </nav>

        <section id="overview" className="ds-case-section grid gap-8 md:grid-cols-[0.65fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">01 · Project overview</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">Context, role, and scope.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-body-muted">{project.context}</p>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            <CaseStudyFact label="Project context" value={project.clientOrContext} />
            <CaseStudyFact label="Role" value={project.role} />
            <CaseStudyFact label="Project type" value={project.projectType} />
            <div className="border-t border-divider-strong py-5 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-label-wide text-muted">Scope</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {project.services.map((service) => (
                  <span key={service} className="border border-divider-strong px-3 py-1.5 text-xs font-medium text-body-strong">{service}</span>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <section id="context" className="scroll-mt-24 border-t border-divider-strong py-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">02 · Product challenge</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">The problem space and implementation focus.</h2>
          </div>
          <div className="mt-8 grid gap-8 border-t border-divider pt-6 md:grid-cols-2 md:gap-12">
            <div>
              <h3 className="text-sm font-semibold text-ink">Implementation focus</h3>
              <p className="mt-3 max-w-xl text-base leading-7 text-body">{project.objective}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Challenge</h3>
              <p className="mt-3 max-w-xl text-base leading-7 text-body">{project.challenge}</p>
            </div>
          </div>
        </section>

        {uxStory.length ? (
          <section id="ux-process" className="scroll-mt-24 border-t border-divider-strong py-14">
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Product design approach</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-display-tight text-ink">How the product experience was shaped.</h2>
            <div className="mt-8 space-y-4">
              {uxStory.map(({ key, title, index, section }) => (
                <CaseStudyStage key={key} index={index} title={title} section={section} />
              ))}
            </div>
          </section>
        ) : null}

        {developmentStory.length ? (
          <section id="development" className="scroll-mt-24 border-t border-divider-strong py-14">
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Development · documented scope</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-display-tight text-ink">What was built and what can be verified.</h2>
            <div className="mt-8 space-y-4">
              {developmentStory.map(({ key, title, section }, index) => (
                <CaseStudyStage key={key} index={index} title={title} section={section} />
              ))}
            </div>
          </section>
        ) : null}

        {project.observedJourneys.length ? (
          <section id="journey" className="scroll-mt-24 border-t border-divider-strong py-16">
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Public product structure</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">
              {project.projectContext === "concept"
                ? "A proposed path through the concept."
                : "Product discovery, as presented on the storefront."}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-body-muted">
              {project.projectContext === "concept"
                ? "These are proposed paths in a fictional concept, not a live product or validated flow."
                : "These are visible entry points and listing details—not claims about research, testing, or completed transactions."}
            </p>
            <ol className="mt-8 grid border-y border-divider-strong md:grid-cols-3">
              {project.observedJourneys.map((journey, index) => (
                <li key={journey} className="border-b border-divider-strong py-5 last:border-b-0 md:border-b-0 md:px-5 md:py-7 md:first:pl-0 md:last:pr-0 md:[&:not(:last-child)]:border-r">
                  <p className="text-xs font-semibold uppercase tracking-label-wide text-accent-deep">0{index + 1}</p>
                  <p className="mt-4 text-base leading-7 text-body-strong">{journey}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {project.visibleExperienceChoices.length ? (
          <section className="grid gap-8 border-t border-divider-strong py-16 md:grid-cols-[0.65fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">
                {project.projectContext === "concept" ? "Concept directions" : "Key takeaways · visible interface"}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Details visible in the experience</h2>
              <p className="mt-4 text-sm leading-7 text-body-muted">
                {project.projectContext === "concept"
                  ? "Proposed directions for this fictional concept—not observed behavior in a live product."
                  : "Observable interface and content groupings—not claims about a formal design system, research, or usability testing."}
              </p>
            </div>
            <ul className="divide-y divide-divider-strong border-y border-divider-strong">
              {project.visibleExperienceChoices.map((choice) => (
                <li key={choice} className="flex gap-4 py-5 text-sm leading-7 text-body-strong">
                  <Check size={16} aria-hidden="true" className="mt-1 shrink-0 text-accent-deep" />
                  {choice}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {project.seoEvidence ? (
          <section id="seo" className="ds-case-section grid gap-8 border-t border-divider-strong md:grid-cols-[0.65fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Search foundations</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">SEO, based on what is verifiable.</h2>
            </div>
            <div>
              <p className="max-w-3xl text-base leading-7 text-body-strong">{project.seoEvidence.summary}</p>
              <ul className="mt-6 divide-y divide-divider-strong border-y border-divider-strong">
                {project.seoEvidence.verified.map((item) => (
                  <li key={item} className="py-4 text-sm leading-7 text-body">{item}</li>
                ))}
              </ul>
              {project.seoEvidence.evidenceNote ? (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-body-muted">{project.seoEvidence.evidenceNote}</p>
              ) : null}
              {project.seoEvidence.media?.length ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {project.seoEvidence.media.map((media) => (
                    <figure key={media.src} className="overflow-hidden rounded-xl bg-paper">
                      <div className="relative aspect-[4/3]">
                        <Image src={media.src} alt={media.alt} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                      </div>
                      {media.caption ? <figcaption className="px-3 py-2 text-xs text-body-muted">{media.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {project.responsiveEvidence ? (
          <section id="responsive" className="ds-case-section grid gap-8 border-t border-divider-strong md:grid-cols-[0.65fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Responsive review</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Viewport fit, checked.</h2>
            </div>
            <div>
              <p className="max-w-3xl text-base leading-7 text-body-strong">{project.responsiveEvidence.summary}</p>
              <ul aria-label="Tested viewport widths" className="mt-6 flex flex-wrap gap-2">
                {project.responsiveEvidence.viewportWidths.map((width) => (
                  <li key={width} className="border border-divider-strong px-3 py-2 text-xs font-medium text-body-strong">{width}px</li>
                ))}
              </ul>
              {project.responsiveEvidence.evidenceNote ? (
                <p className="mt-5 max-w-3xl text-sm leading-7 text-body-muted">{project.responsiveEvidence.evidenceNote}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {project.gallery.length ? (
          <section id="gallery" className="scroll-mt-24 border-t border-divider-strong py-14">
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Selected artefacts</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">Screens, flows, and project detail</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {project.gallery.map((media) => (
                <figure key={media.src} className="overflow-hidden rounded-control bg-surface">
                  <div className="relative aspect-[4/3]">
                    <Image src={media.src} alt={media.alt} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  </div>
                  {media.caption ? <figcaption className="px-4 py-3 text-sm text-body-muted">{media.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section id="evidence" className="grid scroll-mt-24 gap-8 border-t border-divider-strong py-16 md:grid-cols-[0.65fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-label-wide text-muted">Evidence & limitations</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink">What this case study can support.</h2>
          </div>
          <div>
            {project.verifiedOutcomes.length ? (
              <ul className="mb-6 divide-y divide-divider-strong border-y border-divider-strong">
                {project.verifiedOutcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3 py-4 text-sm leading-7 text-body-strong">
                    <Check size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-deep" />
                    {outcome}
                  </li>
                ))}
              </ul>
            ) : null}
            {project.evidenceNote ? <p className="text-base leading-7 text-body-strong">{project.evidenceNote}</p> : null}
            {!project.verifiedOutcomes.length && !project.evidenceNote ? (
              <p className="text-base leading-7 text-body-strong">No measured outcomes are published for this project.</p>
            ) : null}
          </div>
        </section>

        <footer className="mt-4 border-t border-divider-strong bg-ink px-6 py-10 text-paper sm:px-8 sm:py-12">
          <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-label-wide text-accent">Next step</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-display-tight sm:text-4xl">Have a product or website challenge to work through?</h2>
              <Link href="/work" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-on-dark/75 hover:text-on-dark">
                Browse all work <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-56">
              <Link href={`/contact?intent=project&project=${project.slug}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-ink hover:bg-accent-bright">
                Discuss a project <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {project.liveUrl ? (
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-on-dark/25 px-5 py-3 text-sm font-medium text-on-dark hover:border-on-dark/60">
                  Revisit the live website <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

type CaseStudyBlock = NonNullable<NonNullable<WorkProject["uxDesign"]>["discovery"]>;

function CaseStudyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-divider-strong py-5">
      <dt className="text-xs font-medium uppercase tracking-label-wide text-muted">{label}</dt>
      <dd className="mt-3 text-sm leading-7 text-body-strong">{value}</dd>
    </div>
  );
}

function CaseStudyStage({ index, title, section }: { index: number; title: string; section: CaseStudyBlock }) {
  return (
    <article className="grid gap-4 rounded-panel border border-divider bg-surface p-5 sm:grid-cols-[3rem_1fr] sm:gap-6 sm:p-7">
      <p className="text-sm font-semibold text-accent-mid">0{index + 1}</p>
      <div>
        <h3 className="text-xl font-semibold tracking-display-tight text-ink">{title}</h3>
        {section.summary ? <p className="mt-3 text-sm leading-7 text-body">{section.summary}</p> : null}
        {section.points?.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {section.points.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-6 text-body">
                <Check size={15} aria-hidden="true" className="mt-1 shrink-0 text-accent-deep" />
                {point}
              </li>
            ))}
          </ul>
        ) : null}
        {section.media?.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {section.media.map((media) => (
              <figure key={media.src} className="overflow-hidden rounded-xl bg-paper">
                <div className="relative aspect-[4/3]">
                  <Image src={media.src} alt={media.alt} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                </div>
                {media.caption ? <figcaption className="px-3 py-2 text-xs text-body-muted">{media.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
