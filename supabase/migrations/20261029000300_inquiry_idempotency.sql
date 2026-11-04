-- Prevent duplicate inquiry records on network retry without altering old records.
BEGIN;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS submission_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_submission_key_unique ON public.inquiries(submission_key);
COMMIT;
