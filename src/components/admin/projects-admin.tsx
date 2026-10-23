"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import {
  workProjectDraftSchema,
  workProjectSchema,
  type WorkProjectDraft,
} from "@/lib/work-project-schema";

type ProjectStatus = "draft" | "published";
type ProjectRecord = {
  slug: string;
  status: ProjectStatus;
  data: unknown;
  updated_at: string | null;
  source: "static" | "database";
};
type ProjectPage = "product-design" | "development" | "seo";
type StageMedia = NonNullable<NonNullable<WorkProjectDraft["uxDesign"]>["discovery"]>["media"];
type EditableStage = {
  summary?: string;
  points?: string[];
  media?: StageMedia;
};
type UploadTarget =
  | { kind: "cover" }
  | { kind: "ux"; stage: keyof NonNullable<WorkProjectDraft["uxDesign"]> }
  | { kind: "development"; stage: keyof NonNullable<WorkProjectDraft["development"]> }
  | { kind: "seo" };
const projectRecordListSchema = z.array(z.object({
  slug: z.string(),
  status: z.enum(["draft", "published"]),
  data: z.unknown(),
  updated_at: z.string().nullable(),
  source: z.enum(["static", "database"]),
}));

const serviceOptions = ["Product Design", "Next.js Development", "SEO"] as const;
const projectPages: { id: ProjectPage; title: string; description: string; href: string }[] = [
  { id: "product-design", title: "Product Design", description: "Discovery, information architecture, wireframes, UI design and handoff—with images for each stage.", href: "/admin/projects/product-design" },
  { id: "development", title: "Next.js Development", description: "Scope, technical approach, implementation, integrations, QA and deployment.", href: "/admin/projects/development" },
  { id: "seo", title: "SEO", description: "Technical and on-page findings, evidence, and visual audit artefacts.", href: "/admin/projects/seo" },
];
const uxStages: { key: keyof NonNullable<WorkProjectDraft["uxDesign"]>; title: string; description: string }[] = [
  { key: "discovery", title: "01 · Discovery", description: "Research scope, source material, audiences and project assumptions." },
  { key: "define", title: "02 · Define", description: "Goals, users, requirements and the problem being solved." },
  { key: "sitemapAndIa", title: "03 · Information architecture", description: "Sitemaps, navigation structures and content relationships. Add sitemap visuals here." },
  { key: "wireframes", title: "04 · Wireframes", description: "Low-fidelity screens, key states and user flows. Add wireframe images here." },
  { key: "uiDesign", title: "05 · UI design", description: "Visual system, high-fidelity screens and interaction details." },
  { key: "designAudit", title: "06 · Design audit", description: "Audit scope, observations, accessibility and improvement areas." },
  { key: "prototypeTesting", title: "07 · Prototype & testing", description: "Prototype artefacts and only the testing that was actually conducted." },
  { key: "developerHandoff", title: "08 · Developer handoff", description: "Handoff package, specifications, responsive rules and delivery notes." },
];
const developmentStages: { key: keyof NonNullable<WorkProjectDraft["development"]>; title: string; description: string }[] = [
  { key: "briefAndScope", title: "01 · Brief & scope", description: "Requirements, deliverables, assumptions and constraints." },
  { key: "technicalApproach", title: "02 · Technical approach", description: "Architecture, stack, data, rendering and implementation decisions." },
  { key: "implementation", title: "03 · Implementation", description: "What was built and how the important flows work." },
  { key: "integrations", title: "04 · Integrations", description: "External services, APIs and system boundaries." },
  { key: "qualityAssurance", title: "05 · Quality assurance", description: "Testing scope, responsive checks, accessibility and known limits." },
  { key: "deploymentAndHandoff", title: "06 · Deployment & handoff", description: "Deployment, release checks, documentation and handoff." },
];
const emptyProject = (): WorkProjectDraft => ({
  slug: "",
  title: "",
  discipline: "ux-design",
  projectContext: "client",
  status: "draft",
  isFeatured: false,
  displayOrder: 0,
  projectType: "",
  summary: "",
  visibilityLabel: "",
  role: "",
  clientOrContext: "",
  services: ["Product Design"],
  objective: "",
  context: "",
  challenge: "",
  gallery: [],
});

const inputClass = "mt-1.5 w-full rounded-lg border border-divider-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent-deep focus:ring-2 focus:ring-accent-deep/20";
const labelClass = "block text-sm font-medium text-ink";
const sectionClass = "rounded-xl border border-divider bg-surface p-5 sm:p-6";

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function objectValue(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.join("\n")
    : "";
}

function linesToList(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function projectTitle(project: ProjectRecord) {
  return textValue(objectValue(project.data).title) || project.slug;
}

function projectSummary(project: ProjectRecord) {
  return textValue(objectValue(project.data).summary) || "Draft — add project details.";
}

function statusLabel(status: ProjectStatus) {
  return status === "published" ? "Published" : "Draft";
}

function StageEditor({
  title,
  description,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  title: string;
  description: string;
  value: EditableStage;
  onChange: (value: EditableStage) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const points = value.points ?? [];
  const media = value.media ?? [];
  return (
    <details className={sectionClass}>
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-base font-semibold text-ink">{title}</span>
          <span className="text-xs text-body-muted">{media.length} image{media.length === 1 ? "" : "s"}</span>
        </span>
        <span className="mt-2 block text-sm leading-6 text-body-muted">{description}</span>
      </summary>
      <div className="mt-5 space-y-4 border-t border-divider-strong pt-5">
        <label className={labelClass}>
          Stage summary
          <textarea className={inputClass} rows={3} value={value.summary ?? ""} onChange={(event) => onChange({ ...value, summary: event.target.value })} />
        </label>
        <label className={labelClass}>
          Decisions and details (one per line)
          <textarea className={inputClass} rows={4} value={points.join("\n")} onChange={(event) => onChange({ ...value, points: linesToList(event.target.value) })} />
        </label>
        <label className={labelClass}>
          Add this stage&apos;s images
          <input className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-medium file:text-on-dark`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUpload(file);
          }} />
          {uploading ? <span role="status" className="mt-1 block text-xs font-normal text-body-muted">Uploading image…</span> : null}
        </label>
        {media.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {media.map((image, index) => (
              <div key={`${image.src}-${index}`} className="rounded-lg border border-divider p-3">
                <Image src={image.src} alt={image.alt} width={640} height={400} unoptimized className="aspect-[4/3] w-full rounded-md bg-paper-raised object-cover" />
                <label className={`${labelClass} mt-3`}>
                  Image alt text
                  <input className={inputClass} value={image.alt} onChange={(event) => onChange({
                    ...value,
                    media: media.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item),
                  })} />
                </label>
                <label className={`${labelClass} mt-3`}>
                  Caption
                  <input className={inputClass} value={image.caption ?? ""} onChange={(event) => onChange({
                    ...value,
                    media: media.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item),
                  })} />
                </label>
                <button type="button" className="mt-3 text-xs font-medium text-danger-strong underline underline-offset-4" onClick={() => onChange({
                  ...value,
                  media: media.filter((_, itemIndex) => itemIndex !== index),
                })}>Remove image from stage</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ProjectsAdmin({ page = null }: { page?: ProjectPage | null }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkProjectDraft>(() => {
    const initial = emptyProject();
    if (page === "development") {
      initial.discipline = "development";
      initial.services = ["Next.js Development"];
    } else if (page === "seo") {
      initial.discipline = "seo";
      initial.services = ["SEO"];
    }
    return initial;
  });
  const [publicationStatus, setPublicationStatus] = useState<ProjectStatus>("draft");
  const [responsiveSummary, setResponsiveSummary] = useState("");
  const [responsiveWidths, setResponsiveWidths] = useState("");
  const [responsiveEvidenceNote, setResponsiveEvidenceNote] = useState("");
  const [seoSummaryText, setSeoSummaryText] = useState("");
  const [seoVerifiedText, setSeoVerifiedText] = useState("");
  const [seoEvidenceNoteText, setSeoEvidenceNoteText] = useState("");
  const [journeysText, setJourneysText] = useState("");
  const [choicesText, setChoicesText] = useState("");
  const [outcomesText, setOutcomesText] = useState("");
  const [evidenceNoteText, setEvidenceNoteText] = useState("");
  const [customServicesText, setCustomServicesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loginHref = `/admin/discovery/login?next=${encodeURIComponent(page ? projectPages.find((item) => item.id === page)?.href ?? "/admin/projects" : "/admin/projects")}`;

  const loadProjects = useCallback(async () => {
    const response = await fetch("/api/admin/projects", { cache: "no-store" });
    const payload: unknown = await response.json();
    const body = objectValue(payload);
    if (response.status === 401) {
      router.replace(loginHref);
      return [];
    }
    if (!response.ok || body.success !== true || !Array.isArray(body.projects)) {
      throw new Error(textValue(body.message) || "Projects could not be loaded.");
    }
    const parsed = projectRecordListSchema.safeParse(body.projects);
    if (!parsed.success) throw new Error("The project list had an unexpected format.");
    const loaded = parsed.data;
    setProjects(loaded);
    setError("");
    return loaded;
  }, [loginHref, router]);

  useEffect(() => {
    // This fetch synchronizes the admin list with persisted portfolio records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects()
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Projects could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [loadProjects]);

  const resetEditor = () => {
    setEditingSlug(null);
    const initial = emptyProject();
    if (page === "development") {
      initial.discipline = "development";
      initial.services = ["Next.js Development"];
    } else if (page === "seo") {
      initial.discipline = "seo";
      initial.services = ["SEO"];
    }
    setDraft(initial);
    setPublicationStatus("draft");
    setResponsiveSummary("");
    setResponsiveWidths("");
    setResponsiveEvidenceNote("");
    setSeoSummaryText("");
    setSeoVerifiedText("");
    setSeoEvidenceNoteText("");
    setJourneysText("");
    setChoicesText("");
    setOutcomesText("");
    setEvidenceNoteText("");
    setCustomServicesText("");
    setConfirmDelete(false);
    setError("");
    setNotice("");
  };

  const editProject = (record: ProjectRecord) => {
    const raw = { ...objectValue(record.data), slug: record.slug, status: "draft" };
    const parsed = workProjectDraftSchema.safeParse(raw);
    if (!parsed.success) {
      setError(`Project "${record.slug}" could not be opened because its saved content is invalid.`);
      return;
    }
    const data = parsed.data;
    const canonical = new Set<string>(serviceOptions);
    setEditingSlug(record.slug);
    setDraft(data);
    setPublicationStatus(record.status);
    setSeoSummaryText(textValue(data.seoEvidence?.summary));
    setSeoVerifiedText(stringList(data.seoEvidence?.verified));
    setSeoEvidenceNoteText(textValue(data.seoEvidence?.evidenceNote));
    setResponsiveSummary(textValue(data.responsiveEvidence?.summary));
    setResponsiveWidths(Array.isArray(data.responsiveEvidence?.viewportWidths) ? data.responsiveEvidence.viewportWidths.join("\n") : "");
    setResponsiveEvidenceNote(textValue(data.responsiveEvidence?.evidenceNote));
    setJourneysText(stringList(data.observedJourneys));
    setChoicesText(stringList(data.visibleExperienceChoices));
    setOutcomesText(stringList(data.verifiedOutcomes));
    setEvidenceNoteText(textValue(data.evidenceNote));
    setCustomServicesText((data.services ?? []).filter((service) => !canonical.has(service)).join("\n"));
    setConfirmDelete(false);
    setError("");
    setNotice("");
  };

  const updateProject = <K extends keyof WorkProjectDraft>(key: K, value: WorkProjectDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateUXStage = (stage: keyof NonNullable<WorkProjectDraft["uxDesign"]>, value: EditableStage) => {
    updateProject("uxDesign", { ...draft.uxDesign, [stage]: value });
  };

  const updateDevelopmentStage = (stage: keyof NonNullable<WorkProjectDraft["development"]>, value: EditableStage) => {
    updateProject("development", { ...draft.development, [stage]: value });
  };

  const uploadImage = async (file: File, target: UploadTarget) => {
    if (!draft.slug?.trim()) {
      setError("Add a project URL slug before uploading images.");
      return;
    }

    const targetKey = target.kind === "ux" || target.kind === "development"
      ? `${target.kind}-${target.stage}`
      : target.kind;
    setUploading(true);
    setUploadingTarget(targetKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/projects/upload?slug=${encodeURIComponent(draft.slug)}`,
        { method: "POST", headers: { "Content-Type": file.type }, body: file },
      );
      const responseBody: unknown = await response.json();
      const result = objectValue(responseBody);
      if (response.status === 401) {
        router.replace(loginHref);
        return;
      }
      if (!response.ok || result.success !== true || typeof result.url !== "string") {
        throw new Error(textValue(result.message) || "Image could not be uploaded.");
      }

      const media = { src: result.url, alt: `${draft.title?.trim() || "Project"} ${targetKey.replaceAll("-", " ")} image` };
      if (target.kind === "cover") {
        updateProject("coverMedia", media);
      } else if (target.kind === "ux") {
        const current = draft.uxDesign?.[target.stage] ?? {};
        updateUXStage(target.stage, { ...current, media: [...(current.media ?? []), media] });
      } else if (target.kind === "development") {
        const current = draft.development?.[target.stage] ?? {};
        updateDevelopmentStage(target.stage, { ...current, media: [...(current.media ?? []), media] });
      } else {
        const current = draft.seoEvidence ?? { summary: "", verified: [] };
        updateProject("seoEvidence", { ...current, media: [...(current.media ?? []), media] });
      }
      setNotice("Image uploaded. Save the project to publish this media.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image could not be uploaded.");
    } finally {
      setUploading(false);
      setUploadingTarget(null);
    }
  };

  const saveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const serviceList = [
        ...new Set([
          ...(draft.services ?? []).filter((service) => serviceOptions.includes(service as typeof serviceOptions[number])),
          ...linesToList(customServicesText),
        ]),
      ];
      const payload: Record<string, unknown> = {
        ...draft,
        status: publicationStatus,
        services: serviceList.length ? serviceList : undefined,
        coverMedia: draft.coverMedia?.src
          ? draft.coverMedia
          : undefined,
        gallery: draft.gallery ?? [],
        uxDesign: draft.uxDesign,
        development: draft.development,
        seoEvidence: page === "seo" || (draft.services ?? []).includes("SEO")
          ? {
            summary: seoSummaryText,
            verified: linesToList(seoVerifiedText),
            evidenceNote: seoEvidenceNoteText.trim() || undefined,
            media: draft.seoEvidence?.media ?? [],
          }
          : draft.seoEvidence,
        responsiveEvidence: responsiveSummary.trim()
          ? {
            summary: responsiveSummary,
            viewportWidths: linesToList(responsiveWidths).map(Number),
            evidenceNote: responsiveEvidenceNote.trim() || undefined,
          }
          : undefined,
        observedJourneys: linesToList(journeysText),
        visibleExperienceChoices: linesToList(choicesText),
        verifiedOutcomes: linesToList(outcomesText),
        evidenceNote: evidenceNoteText.trim() || undefined,
      };
      if (publicationStatus === "published" && !textValue(payload.publishedAt)) {
        payload.publishedAt = new Date().toISOString();
      }
      const parsed = publicationStatus === "published"
        ? workProjectSchema.safeParse(payload)
        : workProjectDraftSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Project details are incomplete.");
      }

      const response = await fetch(
        editingSlug
          ? `/api/admin/projects/${encodeURIComponent(editingSlug)}`
          : "/api/admin/projects",
        {
          method: editingSlug ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const responseBody: unknown = await response.json();
      const result = objectValue(responseBody);
      if (response.status === 401) {
        router.replace(loginHref);
        return;
      }
      if (!response.ok || result.success !== true) {
        throw new Error(textValue(result.message) || "Project could not be saved.");
      }

      const saved = objectValue(result.project);
      const savedRecord = z.object({
        slug: z.string(),
        status: z.enum(["draft", "published"]),
        data: z.unknown(),
        updated_at: z.string(),
      }).safeParse(saved);
      if (!savedRecord.success) {
        throw new Error("The saved project response had an unexpected format.");
      }
      setEditingSlug(savedRecord.data.slug);
      setDraft(workProjectDraftSchema.parse({
        ...objectValue(savedRecord.data.data),
        slug: savedRecord.data.slug,
        status: "draft",
      }));
      setPublicationStatus(savedRecord.data.status);
      const savedData = objectValue(savedRecord.data.data);
      const savedSeo = objectValue(savedData.seoEvidence);
      setSeoSummaryText(textValue(savedSeo.summary));
      setSeoVerifiedText(stringList(savedSeo.verified));
      setSeoEvidenceNoteText(textValue(savedSeo.evidenceNote));
      try {
        await loadProjects();
      } catch {
        setNotice("Project was saved, but the list could not be refreshed. Reload the page to confirm the latest list.");
        return;
      }
      setNotice(savedRecord.data.status === "published"
        ? "Project published and visible in the portfolio."
        : "Draft saved. It is not visible on the public site.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Project could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!editingSlug) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(editingSlug)}`, {
        method: "DELETE",
      });
      const responseBody: unknown = await response.json();
      const result = objectValue(responseBody);
      if (response.status === 401) {
        router.replace(loginHref);
        return;
      }
      if (!response.ok || result.success !== true) {
        throw new Error(textValue(result.message) || "Project could not be deleted.");
      }
      await loadProjects();
      resetEditor();
      setNotice("Project deleted from the portfolio.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Project could not be deleted.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/discovery/login");
    router.refresh();
  };

  const visibleProjects = projects.filter((project) => {
    if (!page) return true;
    const data = objectValue(project.data);
    const services = Array.isArray(data.services) ? data.services : [];
    if (page === "product-design") {
      return data.discipline === "ux-design" || data.discipline === "design-development" || services.some((service) => typeof service === "string" && /design/i.test(service));
    }
    if (page === "development") {
      return data.discipline === "development" || data.discipline === "design-development" || services.some((service) => typeof service === "string" && /development|next\.?js/i.test(service));
    }
    return data.discipline === "seo" || services.some((service) => service === "SEO");
  });
  const pageDefinition = projectPages.find((item) => item.id === page);
  const pageServices = page === "product-design"
    ? ["Product Design"]
    : page === "development"
      ? ["Next.js Development"]
      : ["SEO"];

  if (!page) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-label text-muted">Private · Portfolio</p>
            <h1 className="mt-2 text-3xl font-semibold">Project management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-body-muted">Choose the matching project workflow. Each service has its own page and case-study structure.</p>
            <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
              <Link href="/admin/projects" aria-current="page" className="text-ink">Portfolio projects</Link>
              <Link href="/admin/discovery" className="underline underline-offset-4">Discovery leads</Link>
              <Link href="/admin/reviews" className="underline underline-offset-4">Reviews</Link>
              <Link href="/admin/clients" className="underline underline-offset-4">Client projects</Link>
            </nav>
          </div>
          <button type="button" onClick={signOut} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium">Sign out</button>
        </header>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {projectPages.map((item) => {
            const count = projects.filter((project) => {
              const data = objectValue(project.data);
              const services = Array.isArray(data.services) ? data.services : [];
              if (item.id === "product-design") return data.discipline === "ux-design" || data.discipline === "design-development" || services.some((service) => typeof service === "string" && /design/i.test(service));
              if (item.id === "development") return data.discipline === "development" || data.discipline === "design-development" || services.some((service) => typeof service === "string" && /development|next\.?js/i.test(service));
              return data.discipline === "seo" || services.some((service) => service === "SEO");
            }).length;
            return (
              <Link key={item.id} href={item.href} className={`${sectionClass} group block transition hover:border-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep`}>
                <p className="text-xs font-medium uppercase tracking-label-compact text-muted">{count} existing project{count === 1 ? "" : "s"}</p>
                <h2 className="mt-3 text-xl font-semibold text-ink">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-body-muted">{item.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink">Open {item.title} workflow <ArrowRight size={16} aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
        {error ? <p role="alert" className="mt-6 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-strong">{error}</p> : null}
        {loading ? <p role="status" className="mt-6 text-sm text-body-muted">Loading existing portfolio projects…</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-label text-muted">Private · Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold">{pageDefinition?.title} projects</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-body-muted">
            {pageDefinition?.description}
          </p>
          <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            <Link href="/admin/projects" className="underline underline-offset-4">All project types</Link>
            {projectPages.map((item) => (
              <Link key={item.id} href={item.href} aria-current={item.id === page ? "page" : undefined} className={item.id === page ? "text-ink" : "underline underline-offset-4"}>{item.title}</Link>
            ))}
            <Link href="/admin/discovery" className="underline underline-offset-4">Discovery leads</Link>
            <Link href="/admin/reviews" className="underline underline-offset-4">Reviews</Link>
            <Link href="/admin/clients" className="underline underline-offset-4">Client projects</Link>
          </nav>
        </div>
        <button type="button" onClick={signOut} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep">
          Sign out
        </button>
      </header>

      {error ? <p role="alert" className="mt-6 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-strong">{error}</p> : null}
      {notice ? <p role="status" className="mt-6 rounded-xl border border-success-line bg-success-soft p-4 text-sm text-success-strong">{notice}</p> : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="projects-list-heading" className={`${sectionClass} lg:sticky lg:top-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="projects-list-heading" className="text-lg font-semibold">Portfolio projects</h2>
              <p className="mt-1 text-xs text-body-muted">{visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"} · static content is editable</p>
            </div>
            <button type="button" onClick={resetEditor} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-dark hover:bg-ink-hover">
              New {pageDefinition?.title} project
            </button>
          </div>

          {loading ? <p className="py-8 text-sm text-body-muted" role="status">Loading projects…</p> : null}
          {!loading && visibleProjects.length === 0 ? <p className="py-8 text-sm text-body-muted">No projects in this category yet. Create your first one.</p> : null}
          <ul className="mt-5 divide-y divide-divider-strong">
            {visibleProjects.map((project) => (
              <li key={project.slug}>
                <button
                  type="button"
                  onClick={() => editProject(project)}
                  aria-current={editingSlug === project.slug ? "true" : undefined}
                  className={`w-full py-4 text-left ${editingSlug === project.slug ? "text-ink" : "text-body-strong hover:text-ink"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{projectTitle(project)}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-body-muted">{projectSummary(project)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-caption font-medium ${project.status === "published" ? "bg-success-soft text-success-strong" : "bg-paper-raised text-body-muted"}`}>
                      {statusLabel(project.status)}
                    </span>
                  </span>
                  <span className="mt-2 block text-caption text-body-muted">{project.source === "static" ? "Existing site content" : `/${project.slug}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={saveProject} className="space-y-6">
          <section className={sectionClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{editingSlug ? "Edit project" : "Create project"}</h2>
                <p className="mt-1 text-sm text-body-muted">Save a draft at any time. Publishing checks all required case-study sections.</p>
              </div>
              <label className={labelClass}>
                Publication
                <select className={inputClass} value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as ProjectStatus)}>
                  <option value="draft">Draft — private</option>
                  <option value="published">Published — public</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Project title *
                <input className={inputClass} required value={draft.title ?? ""} onChange={(event) => updateProject("title", event.target.value)} />
              </label>
              <label className={labelClass}>
                URL slug *
                <input className={inputClass} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug ?? ""} onChange={(event) => updateProject("slug", event.target.value)} />
                <span className="mt-1 block text-xs font-normal text-body-muted">Lowercase letters, numbers, and hyphens.</span>
              </label>
              {page === "product-design" || page === "development" ? (
                <label className="flex items-center gap-3 self-end py-3 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={draft.discipline === "design-development"}
                    onChange={(event) => {
                      const combined = event.target.checked;
                      updateProject("discipline", combined
                        ? "design-development"
                        : page === "development" ? "development" : "ux-design");
                      updateProject("services", combined
                        ? ["Product Design", "Next.js Development"]
                        : [page === "development" ? "Next.js Development" : "Product Design"]);
                    }}
                  />
                  Include {page === "product-design" ? "Next.js Development" : "Product Design"} in this project
                </label>
              ) : (
                <div className="self-end py-3 text-sm font-medium text-ink">SEO case study</div>
              )}
              <label className={labelClass}>
                Project context *
                <select className={inputClass} value={draft.projectContext ?? "client"} onChange={(event) => updateProject("projectContext", event.target.value as WorkProjectDraft["projectContext"])}>
                  <option value="client">Client project</option>
                  <option value="personal">Personal project</option>
                  <option value="concept">Concept / speculative</option>
                </select>
              </label>
              <label className={labelClass}>
                Project type *
                <input className={inputClass} value={draft.projectType ?? ""} onChange={(event) => updateProject("projectType", event.target.value)} />
              </label>
              <label className={labelClass}>
                Role *
                <input className={inputClass} value={draft.role ?? ""} onChange={(event) => updateProject("role", event.target.value)} />
              </label>
              <label className={labelClass}>
                Client or context *
                <input className={inputClass} value={draft.clientOrContext ?? ""} onChange={(event) => updateProject("clientOrContext", event.target.value)} />
              </label>
              <label className={labelClass}>
                Visibility label *
                <input className={inputClass} value={draft.visibilityLabel ?? ""} onChange={(event) => updateProject("visibilityLabel", event.target.value)} />
              </label>
              <label className={labelClass}>
                Display order
                <input className={inputClass} type="number" min="0" max="10000" value={draft.displayOrder ?? 0} onChange={(event) => updateProject("displayOrder", Number(event.target.value))} />
              </label>
              <label className="flex items-center gap-3 self-end py-3 text-sm font-medium text-ink">
                <input type="checkbox" checked={draft.isFeatured ?? false} onChange={(event) => updateProject("isFeatured", event.target.checked)} />
                Prioritize in the project index
              </label>
            </div>
            <label className={`${labelClass} mt-4`}>
              Project summary *
              <textarea className={inputClass} rows={3} value={draft.summary ?? ""} onChange={(event) => updateProject("summary", event.target.value)} />
            </label>
            <fieldset className="mt-5">
              <legend className={labelClass}>Services in scope *</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {pageServices.map((service) => (
                  <label key={service} className="inline-flex items-center gap-2 text-sm text-body-strong">
                    <input type="checkbox" checked readOnly />
                    {service}
                  </label>
                ))}
                {draft.discipline === "design-development" ? (
                  <span className="inline-flex items-center gap-2 text-sm text-body-strong"><input type="checkbox" checked readOnly />{page === "product-design" ? "Next.js Development" : "Product Design"}</span>
                ) : null}
              </div>
              <label className={`${labelClass} mt-4`}>
                Additional service labels (one per line)
                <textarea className={inputClass} rows={2} value={customServicesText} onChange={(event) => setCustomServicesText(event.target.value)} />
              </label>
            </fieldset>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">{page === "product-design" ? "Product Design overview" : page === "development" ? "Development overview" : "SEO engagement overview"}</h2>
            <p className="mt-1 text-sm text-body-muted">{page === "product-design" ? "Set the design context first, then document the ordered design stages below." : page === "development" ? "Describe the build context, then document the technical and delivery stages below." : "Set the SEO engagement context, then record verified technical and on-page findings below."}</p>
            <label className={`${labelClass} mt-5`}>
              {page === "seo" ? "SEO objective / scope *" : "Objective *"}
              <textarea className={inputClass} rows={3} value={draft.objective ?? ""} onChange={(event) => updateProject("objective", event.target.value)} />
            </label>
            <label className={`${labelClass} mt-4`}>
              {page === "seo" ? "Site and audit context *" : "Project context *"}
              <textarea className={inputClass} rows={4} value={draft.context ?? ""} onChange={(event) => updateProject("context", event.target.value)} />
            </label>
            <label className={`${labelClass} mt-4`}>
              {page === "seo" ? "SEO challenge / opportunity *" : "Challenge *"}
              <textarea className={inputClass} rows={3} value={draft.challenge ?? ""} onChange={(event) => updateProject("challenge", event.target.value)} />
            </label>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Hero image and project link</h2>
            <p className="mt-1 text-sm text-body-muted">Add the main project image separately from stage screenshots. Supported: JPG, PNG, WebP, or AVIF up to 5 MB each.</p>
            <label className={`${labelClass} mt-5`}>
              Upload hero image
              <input className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-medium file:text-on-dark`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading || !draft.slug?.trim()} onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadImage(file, { kind: "cover" });
              }} />
              {uploadingTarget === "cover" ? <span role="status" className="mt-1 block text-xs font-normal text-body-muted">Uploading hero image…</span> : null}
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Cover image URL
                <input className={inputClass} value={draft.coverMedia?.src ?? ""} onChange={(event) => updateProject("coverMedia", event.target.value ? { ...draft.coverMedia, src: event.target.value, alt: draft.coverMedia?.alt ?? "" } : undefined)} />
              </label>
              <label className={labelClass}>
                Cover image alt text
                <input className={inputClass} value={draft.coverMedia?.alt ?? ""} onChange={(event) => {
                  if (draft.coverMedia?.src) {
                    updateProject("coverMedia", { ...draft.coverMedia, alt: event.target.value });
                  }
                }} />
              </label>
              <label className={labelClass}>
                Cover caption
                <input className={inputClass} value={draft.coverMedia?.caption ?? ""} onChange={(event) => updateProject("coverMedia", draft.coverMedia ? { ...draft.coverMedia, caption: event.target.value } : undefined)} />
              </label>
              <label className={labelClass}>
                Live project URL (HTTP/HTTPS)
                <input className={inputClass} type="url" value={draft.liveUrl ?? ""} onChange={(event) => updateProject("liveUrl", event.target.value)} />
              </label>
            </div>

            {(draft.gallery ?? []).length ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {(draft.gallery ?? []).map((media, index) => (
                  <li key={`${media.src}-${index}`} className="rounded-lg border border-divider p-3">
                    <Image src={media.src} alt={media.alt} width={640} height={360} unoptimized className="mb-3 aspect-video w-full rounded-md bg-paper-raised object-cover" />
                    <label className={labelClass}>
                      Alt text
                      <input className={inputClass} value={media.alt} onChange={(event) => updateProject("gallery", (draft.gallery ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))} />
                    </label>
                    <label className={`${labelClass} mt-3`}>
                      Caption
                      <input className={inputClass} value={media.caption ?? ""} onChange={(event) => updateProject("gallery", (draft.gallery ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item))} />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" className="text-xs font-medium underline underline-offset-4" onClick={() => updateProject("coverMedia", media)}>Use as cover</button>
                      <button type="button" className="text-xs font-medium text-danger-strong underline underline-offset-4" onClick={() => updateProject("gallery", (draft.gallery ?? []).filter((_, itemIndex) => itemIndex !== index))}>Remove from gallery</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-5 text-sm text-body-muted">No gallery images added.</p>}
          </section>

          {page === "product-design" || draft.discipline === "design-development" && page === "development" ? (
            <section className="space-y-4">
              <div className="px-1">
                <h2 className="text-xl font-semibold text-ink">Product Design process · in order</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-body-muted">Work from discovery through handoff. Expand each stage to add its own narrative, decisions, and images. Information architecture and wireframe artefacts stay attached to those exact stages.</p>
              </div>
              {uxStages.map((stage) => (
                <StageEditor
                  key={stage.key}
                  title={stage.title}
                  description={stage.description}
                  value={draft.uxDesign?.[stage.key] ?? {}}
                  onChange={(value) => updateUXStage(stage.key, value)}
                  onUpload={(file) => void uploadImage(file, { kind: "ux", stage: stage.key })}
                  uploading={uploadingTarget === `ux-${stage.key}`}
                />
              ))}
            </section>
          ) : null}

          {page === "development" || draft.discipline === "design-development" && page === "product-design" ? (
            <section className="space-y-4">
              <div className="px-1">
                <h2 className="text-xl font-semibold text-ink">Next.js Development lifecycle · in order</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-body-muted">Document scope, engineering decisions, delivery and QA independently from the Product Design process.</p>
              </div>
              {developmentStages.map((stage) => (
                <StageEditor
                  key={stage.key}
                  title={stage.title}
                  description={stage.description}
                  value={draft.development?.[stage.key] ?? {}}
                  onChange={(value) => updateDevelopmentStage(stage.key, value)}
                  onUpload={(file) => void uploadImage(file, { kind: "development", stage: stage.key })}
                  uploading={uploadingTarget === `development-${stage.key}`}
                />
              ))}
            </section>
          ) : null}

          {page === "seo" ? (
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold">SEO audit & evidence</h2>
              <p className="mt-1 text-sm leading-6 text-body-muted">Record what was actually inspected and the verifiable findings. Drafts can be saved incomplete; publishing requires an audit summary and at least one verified finding. Do not claim rankings, traffic gains, or guaranteed outcomes without evidence.</p>
              <label className={`${labelClass} mt-5`}>
                Audit summary *
                <textarea className={inputClass} rows={4} maxLength={1000} value={seoSummaryText} onChange={(event) => setSeoSummaryText(event.target.value)} />
              </label>
              <label className={`${labelClass} mt-4`}>
                Verified technical / on-page findings (one per line) *
                <textarea className={inputClass} rows={6} value={seoVerifiedText} onChange={(event) => setSeoVerifiedText(event.target.value)} />
              </label>
              <label className={`${labelClass} mt-4`}>
                Evidence limits and context
                <textarea className={inputClass} rows={3} value={seoEvidenceNoteText} onChange={(event) => setSeoEvidenceNoteText(event.target.value)} />
              </label>
              <label className={`${labelClass} mt-4`}>
                SEO audit screenshots / artefacts
                <input className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-medium file:text-on-dark`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading || !draft.slug?.trim()} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadImage(file, { kind: "seo" });
                }} />
                <span className="mt-1 block text-xs font-normal text-body-muted">Images are displayed alongside the SEO findings on the public case study.</span>
              </label>
              {(draft.seoEvidence?.media ?? []).length ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {(draft.seoEvidence?.media ?? []).map((image, index) => (
                    <div key={`${image.src}-${index}`} className="rounded-lg border border-divider p-3">
                      <Image src={image.src} alt={image.alt} width={640} height={400} unoptimized className="aspect-[4/3] w-full rounded-md bg-paper-raised object-cover" />
                      <label className={`${labelClass} mt-3`}>Alt text<input className={inputClass} value={image.alt} onChange={(event) => {
                        const evidence = draft.seoEvidence;
                        if (evidence) updateProject("seoEvidence", { ...evidence, media: evidence.media?.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) });
                      }} /></label>
                      <label className={`${labelClass} mt-3`}>Caption<input className={inputClass} value={image.caption ?? ""} onChange={(event) => {
                        const evidence = draft.seoEvidence;
                        if (evidence) updateProject("seoEvidence", { ...evidence, media: evidence.media?.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) });
                      }} /></label>
                      <button type="button" className="mt-3 text-xs font-medium text-danger-strong underline underline-offset-4" onClick={() => {
                        const evidence = draft.seoEvidence;
                        if (evidence) updateProject("seoEvidence", { ...evidence, media: evidence.media?.filter((_, itemIndex) => itemIndex !== index) });
                      }}>Remove image</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Evidence and responsive details</h2>
            <p className="mt-1 text-sm text-body-muted">Optional supporting details displayed on the case-study page.</p>
            <div className="mt-5 grid gap-4">
              <label className={labelClass}>
                Responsive review summary
                <textarea className={inputClass} rows={3} value={responsiveSummary} onChange={(event) => setResponsiveSummary(event.target.value)} />
              </label>
              <label className={labelClass}>
                Viewport widths checked (one number per line)
                <textarea className={inputClass} rows={3} inputMode="numeric" placeholder={"375\n768\n1280"} value={responsiveWidths} onChange={(event) => setResponsiveWidths(event.target.value)} />
              </label>
              <label className={labelClass}>
                Responsive evidence note
                <textarea className={inputClass} rows={2} value={responsiveEvidenceNote} onChange={(event) => setResponsiveEvidenceNote(event.target.value)} />
              </label>
              {page !== "seo" ? (
                <>
                  <label className={labelClass}>
                    Observed product journeys (one per line)
                    <textarea className={inputClass} rows={3} value={journeysText} onChange={(event) => setJourneysText(event.target.value)} />
                  </label>
                  <label className={labelClass}>
                    Visible experience choices (one per line)
                    <textarea className={inputClass} rows={3} value={choicesText} onChange={(event) => setChoicesText(event.target.value)} />
                  </label>
                </>
              ) : null}
              <label className={labelClass}>
                Verified outcomes (one per line)
                <textarea className={inputClass} rows={3} value={outcomesText} onChange={(event) => setOutcomesText(event.target.value)} />
              </label>
              <label className={labelClass}>
                Evidence note
                <textarea className={inputClass} rows={3} value={evidenceNoteText} onChange={(event) => setEvidenceNoteText(event.target.value)} />
              </label>
            </div>
          </section>

          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-on-dark/95 p-3 shadow-card backdrop-blur">
            <div className="flex flex-wrap gap-2">
              {editingSlug ? (
                confirmDelete ? (
                  <>
                    <span className="self-center text-sm text-danger-strong">Permanently hide this project?</span>
                    <button type="button" disabled={deleting} onClick={deleteProject} className="rounded-full bg-danger-strong px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{deleting ? "Deleting…" : "Confirm delete"}</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-divider-strong px-4 py-2 text-sm font-medium">Cancel</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-danger-line px-4 py-2 text-sm font-medium text-danger-strong">Delete project</button>
                )
              ) : null}
            </div>
            <button type="submit" disabled={saving || uploading} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-on-dark hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving…" : publicationStatus === "published" ? "Save and publish" : "Save draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
