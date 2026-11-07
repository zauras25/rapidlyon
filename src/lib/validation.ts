import { z } from "zod";
import { services } from "@/data/site";

const legacyServiceValues = new Set([
  "UX/UI & Product Design",
  "Website Development",
  "SEO & Website Optimization",
  "Design + Development",
]);

export const inquirySchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Please enter your full name.").max(120, "Your name must be 120 characters or fewer."),
  email: z.string().trim().email("Please enter a valid email address.").max(254, "Your email address must be 254 characters or fewer."),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  reason: z.enum(["project", "existing", "pricing", "urgent", "other"]).optional(),
  preferredReplyMethod: z.enum(["email", "whatsapp"]).optional(),
  whatsappNumber: z.string().trim().min(5).max(40).optional().or(z.literal("")),
  timeSensitive: z.boolean().optional(),
  service: z.string().trim().refine(
    (value) =>
      value === "Not sure yet" ||
      legacyServiceValues.has(value) ||
      value === "Product Design + Next.js Development" ||
      services.some((service) => service.title === value),
    "Please select a valid service.",
  ),
  projectDescription: z
    .string()
    .trim()
    .min(1, "Please tell us a little about your inquiry.")
    .max(5000, "Please keep your project description under 5,000 characters."),
  budget: z.string().trim().max(80).optional().or(z.literal("")),
  timeline: z.string().trim().max(80).optional().or(z.literal("")),
}).superRefine((inquiry, context) => {
  if (inquiry.preferredReplyMethod === "whatsapp" && !inquiry.whatsappNumber?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["whatsappNumber"],
      message: "Please add your WhatsApp number so we can reply there.",
    });
  }
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;
