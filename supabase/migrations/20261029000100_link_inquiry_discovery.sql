-- Phase 2: preserve original inquiry and discovery IDs while enabling a single lead journey.
-- Apply via the normal migration pipeline after a backup. No existing row is deleted.
BEGIN;
ALTER TABLE public.discovery_submissions
  ADD COLUMN IF NOT EXISTS source_inquiry_id uuid
  REFERENCES public.inquiries(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS discovery_source_inquiry_unique
  ON public.discovery_submissions(source_inquiry_id)
  WHERE source_inquiry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_email_created_idx
  ON public.discovery_submissions(lower(email), created_at DESC);
-- Only the server's service role continues to interact with these records.
COMMIT;
