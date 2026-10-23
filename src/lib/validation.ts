import { z } from "zod";
import { services } from "@/data/site";

const legacyServiceValues = new Set([
  "UX/UI & Product Design",
  "Website Development",
  "SEO & Website Optimization",
  "Design + Development",
]);

export const inquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120, "Your name must be 120 characters or fewer."),
  email: z.string().trim().email("Please enter a valid email address.").max(254, "Your email address must be 254 characters or fewer."),
  company: z.string().trim().max(120).optional().or(z.literal("")),
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
    .min(20, "Please share a bit more detail about your project.")
    .max(5000, "Please keep your project description under 5,000 characters."),
  budget: z.string().trim().max(80).optional().or(z.literal("")),
  timeline: z.string().trim().max(80).optional().or(z.literal("")),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;
