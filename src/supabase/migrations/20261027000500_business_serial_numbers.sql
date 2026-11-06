-- RapidlyOn stable business references, use on staging first.
-- Monotonic sequences: intentionally do not reuse numbers after deletion.
-- Existing proposal and invoice numbers are preserved.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.rapidlyon_inquiry_serial_seq AS bigint;
CREATE SEQUENCE IF NOT EXISTS public.rapidlyon_discovery_serial_seq AS bigint;
CREATE SEQUENCE IF NOT EXISTS public.rapidlyon_proposal_serial_seq AS bigint;
CREATE SEQUENCE IF NOT EXISTS public.rapidlyon_invoice_serial_seq AS bigint;

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS serial_no text;
ALTER TABLE public.discovery_submissions ADD COLUMN IF NOT EXISTS serial_no text;

-- Import any preexisting RAP identifiers into sequence high-water marks.
SELECT setval('public.rapidlyon_inquiry_serial_seq', GREATEST(
  (SELECT last_value FROM public.rapidlyon_inquiry_serial_seq),
  COALESCE((SELECT max(substring(serial_no FROM '^RAP-INQ-([0-9]+)$')::bigint) FROM public.inquiries WHERE serial_no ~ '^RAP-INQ-[0-9]+$'),0),1));
SELECT setval('public.rapidlyon_discovery_serial_seq', GREATEST(
  (SELECT last_value FROM public.rapidlyon_discovery_serial_seq),
  COALESCE((SELECT max(substring(serial_no FROM '^RAP-DSC-([0-9]+)$')::bigint) FROM public.discovery_submissions WHERE serial_no ~ '^RAP-DSC-[0-9]+$'),0),1));
SELECT setval('public.rapidlyon_proposal_serial_seq', GREATEST(
  (SELECT last_value FROM public.rapidlyon_proposal_serial_seq),
  COALESCE((SELECT max(substring(proposal_number FROM '^RAP-PRP-([0-9]+)$')::bigint) FROM public.project_proposals WHERE proposal_number ~ '^RAP-PRP-[0-9]+$'),0),1));
SELECT setval('public.rapidlyon_invoice_serial_seq', GREATEST(
  (SELECT last_value FROM public.rapidlyon_invoice_serial_seq),
  COALESCE((SELECT max(substring(invoice_number FROM '^RAP-INV-([0-9]+)$')::bigint) FROM public.invoices WHERE invoice_number ~ '^RAP-INV-[0-9]+$'),0),1));

-- Backfill oldest submissions first, no existing numbers overwritten.
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.inquiries WHERE serial_no IS NULL ORDER BY created_at,id LOOP
    UPDATE public.inquiries SET serial_no = 'RAP-INQ-' || lpad(nextval('public.rapidlyon_inquiry_serial_seq')::text, 6, '0') WHERE id=r.id;
  END LOOP;
  FOR r IN SELECT id FROM public.discovery_submissions WHERE serial_no IS NULL ORDER BY created_at,id LOOP
    UPDATE public.discovery_submissions SET serial_no = 'RAP-DSC-' || lpad(nextval('public.rapidlyon_discovery_serial_seq')::text, 6, '0') WHERE id=r.id;
  END LOOP;
END $backfill$;

ALTER TABLE public.inquiries ALTER COLUMN serial_no SET NOT NULL;
ALTER TABLE public.discovery_submissions ALTER COLUMN serial_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_serial_no_key ON public.inquiries (serial_no);
CREATE UNIQUE INDEX IF NOT EXISTS discovery_submissions_serial_no_key ON public.discovery_submissions (serial_no);

CREATE OR REPLACE FUNCTION public.rapidlyon_assign_business_serial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'inquiries' AND NEW.serial_no IS DISTINCT FROM OLD.serial_no THEN
      RAISE EXCEPTION 'Inquiry reference cannot be changed';
    ELSIF TG_TABLE_NAME = 'discovery_submissions' AND NEW.serial_no IS DISTINCT FROM OLD.serial_no THEN
      RAISE EXCEPTION 'Discovery reference cannot be changed';
    ELSIF TG_TABLE_NAME = 'project_proposals' AND NEW.proposal_number IS DISTINCT FROM OLD.proposal_number THEN
      RAISE EXCEPTION 'Proposal reference cannot be changed';
    ELSIF TG_TABLE_NAME = 'invoices' AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice reference cannot be changed';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'inquiries' THEN
    NEW.serial_no := 'RAP-INQ-' || lpad(nextval('public.rapidlyon_inquiry_serial_seq')::text, 6, '0');
  ELSIF TG_TABLE_NAME = 'discovery_submissions' THEN
    NEW.serial_no := 'RAP-DSC-' || lpad(nextval('public.rapidlyon_discovery_serial_seq')::text, 6, '0');
  ELSIF TG_TABLE_NAME = 'project_proposals' THEN
    NEW.proposal_number := 'RAP-PRP-' || lpad(nextval('public.rapidlyon_proposal_serial_seq')::text, 6, '0');
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    NEW.invoice_number := 'RAP-INV-' || lpad(nextval('public.rapidlyon_invoice_serial_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.rapidlyon_assign_business_serial() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rapidlyon_serial_inquiries ON public.inquiries;
CREATE TRIGGER rapidlyon_serial_inquiries BEFORE INSERT OR UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.rapidlyon_assign_business_serial();
DROP TRIGGER IF EXISTS rapidlyon_serial_discovery ON public.discovery_submissions;
CREATE TRIGGER rapidlyon_serial_discovery BEFORE INSERT OR UPDATE ON public.discovery_submissions
FOR EACH ROW EXECUTE FUNCTION public.rapidlyon_assign_business_serial();
DROP TRIGGER IF EXISTS rapidlyon_serial_proposal ON public.project_proposals;
CREATE TRIGGER rapidlyon_serial_proposal BEFORE INSERT OR UPDATE ON public.project_proposals
FOR EACH ROW EXECUTE FUNCTION public.rapidlyon_assign_business_serial();
DROP TRIGGER IF EXISTS rapidlyon_serial_invoice ON public.invoices;
CREATE TRIGGER rapidlyon_serial_invoice BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.rapidlyon_assign_business_serial();

-- Only server-side privileged role should read/write business references.
REVOKE ALL ON SEQUENCE public.rapidlyon_inquiry_serial_seq, public.rapidlyon_discovery_serial_seq,
 public.rapidlyon_proposal_serial_seq, public.rapidlyon_invoice_serial_seq FROM PUBLIC, anon, authenticated;
COMMIT;
