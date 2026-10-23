"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Project } from "@/data/site";

type ProjectFilter = "all" | "real" | "concept";

const filters: { id: ProjectFilter; label: string }[] = [
  { id: "all", label: "All projects" },
  { id: "real", label: "Real work" },
  { id: "concept", label: "Concept studies" },
];

const projectContextLabels = {
  client: "Client project",
  personal: "Personal project",
  concept: "Concept · speculative",
} as const;

function matchesFilter(project: Project, filter: ProjectFilter) {
  if (filter === "all") return true;
  if (filter === "concept") return project.projectContext === "concept";
  return project.projectContext === "client" || project.projectContext === "personal";
}

function ProjectVisual({ project }: { project: Project }) {
  if (project.coverMedia) {
    return (
      <figure className="relative aspect-[16/8] overflow-hidden bg-paper-raised">
        <Image
          src={project.coverMedia.src}
          alt={project.coverMedia.alt}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 1200px"
          className="object-cover"
        />
        {project.coverMedia.caption ? (
          <figcaption className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-3 py-1.5 text-xs text-on-dark">
            {project.coverMedia.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex min-h-64 flex-col justify-between p-6 text-paper sm:min-h-80 sm:p-9 ${
        project.projectContext === "concept" ? "bg-forest" : "bg-navy"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-label-tight text-on-dark/65">
        {projectContextLabels[project.projectContext]}
      </p>
      <div>
        <p className="max-w-3xl text-3xl font-semibold leading-tight tracking-display-tight sm:text-5xl">
          {project.title}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-on-dark/70">
          {project.projectType}
        </p>
      </div>
      <p className="text-xs text-on-dark/50">Text-led project cover · no image supplied</p>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="grid gap-6 border-b border-divider-strong py-8 first:pt-0 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-12">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium uppercase tracking-label-tight">
          <span
            className={
              project.projectContext === "concept"
                ? "text-forest"
                : "text-accent-deep"
            }
          >
            {projectContextLabels[project.projectContext]}
          </span>
          <span aria-hidden="true" className="text-muted">·</span>
          <span className="text-muted">{project.projectType}</span>
        </div>
        <Link
          href={`/work/${project.slug}`}
          aria-label={`Read ${project.title} project details (${projectContextLabels[project.projectContext]})`}
          className="group block overflow-hidden rounded-control border border-divider-strong bg-surface shadow-card outline-offset-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-accent-deep"
        >
          <ProjectVisual project={project} />
        </Link>
      </div>

      <div className="flex min-w-0 flex-col items-start justify-center py-1 lg:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-label-compact text-muted">
            {project.visibilityLabel}
          </p>
          {project.isFeatured ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-caption font-semibold uppercase tracking-label-tiny text-accent-deep">Featured</span>
          ) : null}
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-display-tight text-ink sm:text-4xl">
          <Link
            href={`/work/${project.slug}`}
            className="transition-colors hover:text-accent-deep"
          >
            {project.title}
          </Link>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-body">
          {project.summary}
        </p>
        <dl className="mt-6 grid w-full gap-4 border-y border-divider-strong py-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-label-compact text-muted">
              Role
            </dt>
            <dd className="mt-1 text-sm leading-6 text-body-strong">{project.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-label-compact text-muted">
              Services
            </dt>
            <dd className="mt-1 text-sm leading-6 text-body-strong">
              {project.services.join(" · ")}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          <Link
            href={`/work/${project.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
          >
            Read project details <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {project.liveUrl ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-accent-deep"
            >
              Visit live project <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function WorkPortfolio({ projects }: { projects: Project[] }) {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("all");
  const publishedProjects = projects
    .filter((project) => project.status === "published")
    .sort(
      (left, right) =>
        Number(right.isFeatured) - Number(left.isFeatured) ||
        left.displayOrder - right.displayOrder,
    );
  const visibleProjects = publishedProjects.filter((project) =>
    matchesFilter(project, activeFilter),
  );

  return (
    <>
      <div className="flex flex-col gap-5 border-b border-divider-strong pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-display-tight text-ink">
            Project index
          </h2>
          <p className="mt-1 text-sm text-body-muted">
            Project context is identified before each story.
          </p>
        </div>
        <div
          role="group"
          aria-label="Filter projects by context"
          className="flex flex-wrap gap-2"
        >
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep ${
                activeFilter === filter.id
                  ? "bg-ink text-on-dark"
                  : "border border-divider-strong bg-surface text-body hover:border-black/30"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2" aria-live="polite">
        {visibleProjects.length ? (
          visibleProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))
        ) : (
          <p className="py-10 text-sm text-body-muted">
            No published projects in this group yet.
          </p>
        )}
      </div>
      <p className="pt-5 text-sm leading-6 text-body-muted">
        Project summaries describe published scope and visible work. Outcomes
        are included only when supported by project evidence.
      </p>
    </>
  );
}
