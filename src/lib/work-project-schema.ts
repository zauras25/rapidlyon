import { z } from "zod";

const caseStudyMediaSchema = z.object({
  src: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(1).max(300),
  caption: z.string().trim().max(500).optional(),
});

const caseStudyBlockSchema = z.object({
  summary: z.string().trim().max(5000).optional(),
  points: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  media: z.array(caseStudyMediaSchema).max(20).optional(),
});

const uxDesignStorySchema = z.object({
  discovery: caseStudyBlockSchema.optional(),
  define: caseStudyBlockSchema.optional(),
  sitemapAndIa: caseStudyBlockSchema.optional(),
  wireframes: caseStudyBlockSchema.optional(),
  uiDesign: caseStudyBlockSchema.optional(),
  designAudit: caseStudyBlockSchema.optional(),
  prototypeTesting: caseStudyBlockSchema.optional(),
  developerHandoff: caseStudyBlockSchema.optional(),
});

const developmentStorySchema = z.object({
  briefAndScope: caseStudyBlockSchema.optional(),
  technicalApproach: caseStudyBlockSchema.optional(),
  implementation: caseStudyBlockSchema.optional(),
  integrations: caseStudyBlockSchema.optional(),
  qualityAssurance: caseStudyBlockSchema.optional(),
  deploymentAndHandoff: caseStudyBlockSchema.optional(),
});

const seoEvidenceSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  verified: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  evidenceNote: z.string().trim().max(1000).optional(),
  media: z.array(caseStudyMediaSchema).max(20).optional(),
});

const responsiveEvidenceSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  viewportWidths: z.array(z.number().int().min(320).max(2560)).max(20),
  evidenceNote: z.string().trim().max(1000).optional(),
});

const workProjectFieldsSchema = z.object({
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(160),
  discipline: z.enum(["ux-design", "development", "seo", "design-development"]),
  projectContext: z.enum(["client", "personal", "concept"]),
  status: z.enum(["draft", "published"]).default("draft"),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(10000).default(0),
  publishedAt: z.string().datetime().optional(),
  projectType: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1000),
  visibilityLabel: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(300),
  clientOrContext: z.string().trim().min(1).max(300),
  services: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  objective: z.string().trim().min(1).max(3000),
  context: z.string().trim().min(1).max(3000),
  challenge: z.string().trim().min(1).max(3000),
  coverMedia: caseStudyMediaSchema.optional(),
  gallery: z.array(caseStudyMediaSchema).max(40).default([]),
  uxDesign: uxDesignStorySchema.optional(),
  development: developmentStorySchema.optional(),
  seoEvidence: seoEvidenceSchema.optional(),
  responsiveEvidence: responsiveEvidenceSchema.optional(),
  observedJourneys: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
  visibleExperienceChoices: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
  verifiedOutcomes: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
  evidenceNote: z.string().trim().max(1000).optional(),
  liveUrl: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Use an HTTP or HTTPS project URL.").optional(),
});

function removeBlankValues(value: unknown): unknown {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (Array.isArray(value)) {
    return value.map(removeBlankValues).filter((item) => item !== undefined);
  }
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, removeBlankValues(entry)] as const)
      .filter(([, entry]) => entry !== undefined),
  );
}

const workProjectDraftFieldsSchema = workProjectFieldsSchema.partial().extend({
  status: z.literal("draft").default("draft"),
  discipline: z.enum(["ux-design", "development", "seo", "design-development"]).optional(),
  seoEvidence: z.object({
    summary: z.string().trim().max(1000).optional(),
    verified: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
    evidenceNote: z.string().trim().max(1000).optional(),
    media: z.array(caseStudyMediaSchema).max(20).optional(),
  }).optional(),
});

export const workProjectDraftSchema = z.preprocess(
  removeBlankValues,
  workProjectDraftFieldsSchema,
);

export const workProjectSchema = workProjectFieldsSchema.superRefine((project, context) => {
  if ((project.discipline === "ux-design" || project.discipline === "design-development") && !project.uxDesign) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["uxDesign"],
      message: "UX design projects need the UX case-study section model.",
    });
  } else if (
    project.uxDesign &&
    !Object.values(project.uxDesign).some((section) =>
      Boolean(section?.summary || section?.points?.length || section?.media?.length),
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["uxDesign"],
      message: "Add content to at least one UX design stage before publishing.",
    });
  }

  if ((project.discipline === "development" || project.discipline === "design-development") && !project.development) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["development"],
      message: "Development projects need the development case-study section model.",
    });
  } else if (
    project.development &&
    !Object.values(project.development).some((section) =>
      Boolean(section?.summary || section?.points?.length || section?.media?.length),
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["development"],
      message: "Add content to at least one development stage before publishing.",
    });
  }

  if (
    (project.discipline === "seo" || project.services.includes("SEO")) &&
    !project.seoEvidence
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["seoEvidence"],
      message: "SEO projects need verifiable SEO evidence before publishing.",
    });
  }

});

export type WorkProject = z.infer<typeof workProjectSchema>;
export type WorkProjectDraft = z.infer<typeof workProjectDraftSchema>;
