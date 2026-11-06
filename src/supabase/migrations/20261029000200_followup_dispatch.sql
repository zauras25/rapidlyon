-- Durable at-most-once follow-up dispatch attempts. An uncertain delivery must be
-- reviewed rather than automatically duplicated. This is independent from lead status.
BEGIN;
CREATE TABLE IF NOT EXISTS public.follow_up_dispatch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind text NOT NULL CHECK (record_kind IN ('inquiry','discovery')),
  record_id uuid NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_kind,record_id,due_at)
);
CREATE INDEX IF NOT EXISTS follow_up_dispatch_attempts_status_idx
  ON public.follow_up_dispatch_attempts(status,created_at DESC);
ALTER TABLE public.follow_up_dispatch_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.follow_up_dispatch_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.follow_up_dispatch_attempts TO service_role;
COMMIT;
