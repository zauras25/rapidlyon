import { z } from "zod";

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

const answersSchema = z.record(z.string(), z.union([z.string().max(5000), z.array(z.string().max(200)).max(50)]));

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
