import { z } from "zod";

export const reviewSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Your name must be 100 characters or fewer."),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
  review: z.string().trim().min(20, "Please write at least 20 characters.").max(1200, "Please keep your review under 1,200 characters."),
});

export const reviewStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const adminReviewSchema = reviewSchema.extend({
  status: reviewStatusSchema,
  display_order: z.number().int().min(0).max(100000),
});

const reviewClientContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

const reviewProjectContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["draft", "invited", "active", "paused", "completed", "cancelled"]),
  completed_at: z.string().nullable(),
});

export const publishedReviewSchema = reviewSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  display_order: z.number().int().min(0).max(100000),
});

export const adminReviewRecordSchema = adminReviewSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  client_id: z.string().uuid().nullable().optional(),
  client_project_id: z.string().uuid().nullable().optional(),
  client: reviewClientContextSchema.nullable().optional(),
  project: reviewProjectContextSchema.nullable().optional(),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
export type PublishedReview = z.infer<typeof publishedReviewSchema>;
export type AdminReview = z.infer<typeof adminReviewRecordSchema>;
