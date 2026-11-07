import { z } from "zod";
import { engagementOptions } from "@/data/engagement-options";

export const discoveryServices = [
  "Product Design",
  "Next.js Development",
  "SEO",
  "Other / not sure yet",
  "UX/UI & Product Design",
  "Website Development",
  "SEO & Website Optimization",
  "Design + Development",
  // Retain older service values so existing submissions and browser drafts remain readable.
  "UX research and UX/UI design",
  "Website design",
  "Website development",
  "Mobile app design",
  "Product strategy and consulting",
  "Existing product redesign",
  "Other digital product requirements",
] as const;

export const discoveryServiceCategories = discoveryServices.slice(0, 4);

export const discoveryMethods = [
  "Self-guided discovery",
  "Discovery interview",
  "Live demo or product walkthrough",
] as const;

export const discoveryClarificationMethods = [
  "whatsapp",
  "voice",
  "video",
  "moderated",
  "unmoderated",
] as const;

export const discoveryQuestionStatuses = ["draft", "sent", "answered", "closed"] as const;
export const discoveryInvitationStatuses = ["draft", "sent", "failed", "responded", "expired"] as const;
export const discoverySessionStatuses = [
  "selected",
  "planned",
  "awaiting_confirmation",
  "confirmed",
  "reschedule_requested",
  "completed",
] as const;

export const discoveryClarificationQuestionSchema = z.object({
  id: z.string().uuid(),
  category: z.string().max(80),
  prompt: z.string().min(1).max(1000),
  status: z.enum(discoveryQuestionStatuses),
  answer: z.string().nullable(),
  close_reason: z.string().nullable(),
});

export const discoveryClarificationInvitationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(discoveryInvitationStatuses),
  message: z.string().max(5000),
  offered_methods: z.array(z.enum(discoveryClarificationMethods)).min(1).max(5),
  expires_at: z.string().datetime({ offset: true }),
  responded_at: z.string().datetime({ offset: true }).nullable(),
  questions: z.array(discoveryClarificationQuestionSchema),
  session: z.object({
    id: z.string().uuid(),
    method: z.enum(discoveryClarificationMethods),
    status: z.enum(discoverySessionStatuses),
    client_confirmed_services: z.array(z.string()),
    preferred_time: z.string().max(200).nullable(),
    client_note: z.string().max(2000).nullable(),
    planned_at: z.string().datetime({ offset: true }).nullable(),
    duration_minutes: z.number().int().positive().nullable(),
    owner: z.string().max(160).nullable(),
    agenda: z.string().max(5000).nullable(),
    access_details: z.string().max(1000).nullable(),
    findings: z.string().max(10000).nullable(),
    outcome: z.string().max(5000).nullable(),
    confirmed_at: z.string().datetime({ offset: true }).nullable(),
    completed_at: z.string().datetime({ offset: true }).nullable(),
  }).nullable(),
});

export const discoveryScopeReadinessSchema = z.object({
  status: z.enum(["not_reviewed", "more_information", "ready", "not_a_fit"]),
  reason: z.string().max(5000),
  updated_at: z.string().datetime({ offset: true }).nullable(),
});

const engagementOptionIds = new Set<string>(engagementOptions.map((option) => option.id));
const approvedAnswerOptions: Record<string, readonly string[]> = {
  age: ["18–24", "25–34", "35–44", "45–54", "55+", "Prefer not to say"],
  gender: ["Woman", "Man", "Non-binary", "Self-describe", "Prefer not to say"],
  role: ["owner", "employee", "agency", "individual"],
  approval: ["self", "manager", "client", "team", "unknown"],
  digitalExperience: ["new", "basic", "experienced"],
  collaboration: ["guided", "collaborative", "delegated"],
  availability: ["flexible", "weekdays", "evenings", "weekends", "async"],
  timezone: ["Asia/Karachi", "Asia/Dubai", "Europe/London", "America/New_York", "other"],
  projectSituation: ["idea", "partial", "live", "problem", "unsure"],
  designSituation: ["new", "partial", "redesign", "improve"],
  devState: ["figma", "partial", "live", "new", "unsure"],
  seoStatus: ["live", "new", "migration", "unknown"],
  seoObjective: ["ranking", "traffic", "indexing", "local", "technical", "new", "unknown"],
  communication: ["email", "whatsapp", "voice", "video", "flexible"],
  urgency: ["normal", "urgent", "exploring"],
  timeframe: ["immediate", "month", "quarter", "flexible"],
  budgetStatus: ["unknown", "defined", "approval", "scope"],
};

const answersSchema = z.record(z.string(), z.union([z.string().max(5000), z.array(z.string().max(200)).max(50)]))
  .superRefine((answers, context) => {
    const selectedPackageId = answers.selectedPackageId;
    if (
      selectedPackageId !== undefined &&
      (typeof selectedPackageId !== "string" ||
        (selectedPackageId !== "" && !engagementOptionIds.has(selectedPackageId)))
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedPackageId"],
        message: "Choose a valid service path.",
      });
    }

    for (const [field, options] of Object.entries(approvedAnswerOptions)) {
      const value = answers[`approved.${field}`];
      if (value !== undefined && (typeof value !== "string" || !options.includes(value))) {
        context.addIssue({
          code: "custom",
          path: [`approved.${field}`],
          message: "Please review your discovery answers.",
        });
      }
    }

    const selectedServices = answers["approved.selectedServices"];
    const allowedServices = ["Product Design", "Next.js Development", "SEO"];
    if (
      selectedServices !== undefined &&
      (!Array.isArray(selectedServices) ||
        selectedServices.length < 1 ||
        selectedServices.some((service) => !allowedServices.includes(service)))
    ) {
      context.addIssue({
        code: "custom",
        path: ["approved.selectedServices"],
        message: "Choose at least one valid service.",
      });
    }

    const serviceSet = new Set(Array.isArray(selectedServices) ? selectedServices : []);
    const has = (field: string) => answers[`approved.${field}`] !== undefined;
    const designSituation = answers["approved.designSituation"];
    const devState = answers["approved.devState"];
    const seoStatus = answers["approved.seoStatus"];
    const communication = answers["approved.communication"];
    const role = answers["approved.role"];
    const gender = answers["approved.gender"];
    const urgency = answers["approved.urgency"];
    const budgetStatus = answers["approved.budgetStatus"];
    if (answers.formVersion === "approved-v1") {
      const requiredAnswers = [
        "role", "digitalExperience", "collaboration", "availability", "timezone",
        "projectSituation", "communication", "urgency", "timeframe", "budgetStatus",
        ...(serviceSet.has("Product Design") ? ["designSituation"] : []),
        ...(serviceSet.has("Next.js Development") ? ["devState"] : []),
        ...(serviceSet.has("SEO") ? ["seoStatus", "seoObjective"] : []),
      ];
      for (const field of requiredAnswers) {
        if (!has(field)) {
          context.addIssue({
            code: "custom",
            path: [`approved.${field}`],
            message: "Please review your discovery answers.",
          });
        }
      }
    }

    const conditionallyUnavailable = [
      ...(!serviceSet.has("Product Design") ? ["designSituation", "designSummary", "designImprovement", "designActivity", "designReference"] : []),
      ...(!serviceSet.has("Next.js Development") ? ["devState", "devRequirements", "devReference"] : []),
      ...(!serviceSet.has("SEO") ? ["seoStatus", "seoObjective", "seoAudience", "seoUrl"] : []),
      ...(role !== "employee" && role !== "agency" ? ["approval"] : []),
      ...(gender !== "Self-describe" ? ["genderDescription"] : []),
      ...(!["partial", "live", "problem"].includes(String(answers["approved.projectSituation"])) ? ["existingAssetLink"] : []),
      ...(!["partial", "improve", "redesign"].includes(String(designSituation)) ? ["designReference"] : []),
      ...(!["partial", "improve"].includes(String(designSituation)) ? ["designSummary"] : []),
      ...(designSituation !== "redesign" ? ["designImprovement"] : []),
      ...(designSituation !== "new" ? ["designActivity"] : []),
      ...(!["partial", "figma", "live"].includes(String(devState)) ? ["devReference"] : []),
      ...(seoStatus === "new" ? ["seoUrl"] : []),
      ...(!["whatsapp", "voice"].includes(String(communication)) ? ["contactNumber"] : []),
      ...(urgency !== "urgent" ? ["urgencyReason"] : []),
      ...(budgetStatus !== "defined" ? ["budgetAmount"] : []),
    ];
    for (const field of new Set(conditionallyUnavailable)) {
      if (has(field)) {
        context.addIssue({
          code: "custom",
          path: [`approved.${field}`],
          message: "Please review your discovery answers.",
        });
      }
    }
  });

export const discoverySubmissionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(1).max(160),
  website: z.string().trim().max(500),
  country: z.string().trim().min(2).max(100),
  timeZone: z.string().trim().min(1).max(100),
  industry: z.string().trim().min(1).max(120),
  businessStage: z.string().trim().min(1).max(100),
  businessModel: z.string().trim().max(2000),
  services: z.array(z.enum(discoveryServices)).min(1).max(discoveryServices.length),
  answers: answersSchema,
  projectOverview: z.string().trim().min(20).max(5000),
  objectives: z.string().trim().max(5000),
  mustHaveFeatures: z.string().trim().max(5000),
  niceToHaveFeatures: z.string().trim().max(5000),
  constraints: z.string().trim().max(5000),
  budget: z.string().trim().max(100),
  timeline: z.string().trim().max(200),
  productUrl: z.string().trim().max(500),
  competitorReferences: z.string().trim().max(2000),
  discoveryMethod: z.enum(discoveryMethods),
  preferredTimes: z.string().trim().max(2000),
  consent: z.literal(true),
}).superRefine((submission, context) => {
  if (submission.answers.formVersion !== "approved-v1") return;
  const selectedServices = submission.answers["approved.selectedServices"];
  const submittedServices = new Set<string>(submission.services);
  if (
    !Array.isArray(selectedServices) ||
    selectedServices.length !== submittedServices.size ||
    selectedServices.some((service) => !submittedServices.has(service))
  ) {
    context.addIssue({
      code: "custom",
      path: ["answers", "approved.selectedServices"],
      message: "Selected services do not match the discovery answers.",
    });
  }
});

export const discoveryDraftSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  fullName: z.string().max(120).optional(),
  email: z.string().max(254).optional(),
  company: z.string().max(160).optional(),
  website: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  timeZone: z.string().max(100).optional(),
  industry: z.string().max(120).optional(),
  businessStage: z.string().max(100).optional(),
  businessModel: z.string().max(2000).optional(),
  services: z.array(z.enum(discoveryServices)).max(discoveryServices.length).optional(),
  answers: answersSchema.optional(),
  projectOverview: z.string().max(5000).optional(),
  objectives: z.string().max(5000).optional(),
  mustHaveFeatures: z.string().max(5000).optional(),
  niceToHaveFeatures: z.string().max(5000).optional(),
  constraints: z.string().max(5000).optional(),
  budget: z.string().max(100).optional(),
  timeline: z.string().max(200).optional(),
  productUrl: z.string().max(500).optional(),
  competitorReferences: z.string().max(2000).optional(),
  discoveryMethod: z.enum(discoveryMethods).or(z.literal("")).optional(),
  preferredTimes: z.string().max(2000).optional(),
  consent: z.boolean().optional(),
});

export type DiscoverySubmission = z.infer<typeof discoverySubmissionSchema>;

export const discoveryStatuses = [
  "New",
  "In Review",
  "Awaiting Client Information",
  "Meeting Requested",
  "Discovery Completed",
  "Proposal In Progress",
  "Closed",
] as const;

export const discoveryStatusSchema = z.enum(discoveryStatuses);

export const discoveryNotificationStatuses = ["pending", "sending", "sent", "failed"] as const;
export const discoveryNotificationStatusSchema = z.enum(discoveryNotificationStatuses);

export const discoveryAdminSummarySchema = z.object({
  id: z.string().uuid(),
  serial_no: z.string(),
  full_name: z.string(),
  email: z.string().email(),
  company: z.string(),
  services: z.array(z.enum(discoveryServices)),
  discovery_method: z.enum(discoveryMethods),
  status: discoveryStatusSchema,
  created_at: z.string().datetime({ offset: true }),
  next_action: z.string().nullable(),
  follow_up_at: z.string().nullable(),
  notification_status: discoveryNotificationStatusSchema,
  notification_updated_at: z.string().datetime({ offset: true }).nullable(),
});

export const discoveryAdminRecordSchema = discoveryAdminSummarySchema.extend({
  submission: z.record(z.string(), z.unknown()),
  attachment_paths: z.array(z.string()),
  internal_notes: z.string(),
  qualification_status: z.enum(["unqualified", "qualified"]),
  client_id: z.string().uuid().nullable(),
  client_project_id: z.string().uuid().nullable(),
});

export type DiscoveryAdminSummary = z.infer<typeof discoveryAdminSummarySchema>;
export type DiscoveryAdminRecord = z.infer<typeof discoveryAdminRecordSchema>;
