-- RapidlyOn staging reconciliation: preserves the three manually patched trigger functions.
-- Snapshot source: staging SQL Editor pg_get_functiondef output, 2026-11-02.
-- READ / REVIEW ONLY until explicitly approved for a controlled deployment.
-- Do not deploy to production as part of creating this file.

CREATE OR REPLACE FUNCTION public.issue_milestone_installment_invoices()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_agreement_id uuid;
  v_snapshot jsonb;
  v_installment jsonb;
  v_milestone_position integer;
  v_expected_title text;
  v_sequence_two_invoice uuid;
  v_final_milestone_id uuid;
BEGIN
  IF NEW.status NOT IN ('approved', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT agreement.id, proposal.accepted_snapshot
    INTO v_agreement_id, v_snapshot
  FROM public.project_agreements agreement
  JOIN public.project_proposals proposal
    ON proposal.id = agreement.proposal_id
   AND proposal.client_id = agreement.client_id
   AND proposal.project_id = agreement.project_id
  WHERE agreement.project_id = NEW.project_id
    AND agreement.status = 'accepted'
    AND proposal.status = 'accepted'
    AND proposal.accepted_snapshot IS NOT NULL
  ORDER BY agreement.version DESC, agreement.accepted_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_installment := v_snapshot->'payment_schedule'->1;

  IF COALESCE(v_installment->>'milestone_position', '')
     ~ '^[1-9][0-9]{0,1}$'
  THEN
    v_milestone_position :=
      (v_installment->>'milestone_position')::integer;

    IF pg_catalog.jsonb_typeof(v_snapshot->'milestones') = 'array'
       AND v_milestone_position <=
           pg_catalog.jsonb_array_length(v_snapshot->'milestones')
    THEN
      v_expected_title :=
        v_snapshot->'milestones'
        ->(v_milestone_position - 1)->>'title';

      IF NEW.position = v_milestone_position - 1
         AND NEW.title IS NOT DISTINCT FROM v_expected_title
      THEN
        PERFORM public.issue_agreement_installment_invoice(
          v_agreement_id,
          2::smallint,
          NEW.id
        );
      END IF;
    END IF;
  END IF;

  SELECT invoice.id INTO v_sequence_two_invoice
  FROM public.invoices invoice
  WHERE invoice.agreement_id = v_agreement_id
    AND invoice.installment_sequence = 2;

  SELECT milestone.id INTO v_final_milestone_id
  FROM public.project_milestones milestone
  WHERE milestone.project_id = NEW.project_id
  ORDER BY milestone.position DESC
  LIMIT 1;

  IF v_sequence_two_invoice IS NOT NULL
     AND v_final_milestone_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.project_milestones milestone
       WHERE milestone.project_id = NEW.project_id
         AND milestone.status NOT IN ('approved', 'completed')
     )
  THEN
    PERFORM public.issue_agreement_installment_invoice(
      v_agreement_id,
      3::smallint,
      v_final_milestone_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rapidlyon_assign_business_serial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN

    IF TG_TABLE_NAME = 'inquiries' THEN
      IF NEW.serial_no IS DISTINCT FROM OLD.serial_no THEN
        RAISE EXCEPTION 'Inquiry reference cannot be changed';
      END IF;

    ELSIF TG_TABLE_NAME = 'discovery_submissions' THEN
      IF NEW.serial_no IS DISTINCT FROM OLD.serial_no THEN
        RAISE EXCEPTION 'Discovery reference cannot be changed';
      END IF;

    ELSIF TG_TABLE_NAME = 'project_proposals' THEN
      IF NEW.proposal_number IS DISTINCT FROM OLD.proposal_number THEN
        RAISE EXCEPTION 'Proposal reference cannot be changed';
      END IF;

    ELSIF TG_TABLE_NAME = 'invoices' THEN
      IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
        RAISE EXCEPTION 'Invoice reference cannot be changed';
      END IF;

    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN

    IF TG_TABLE_NAME = 'inquiries' THEN
      NEW.serial_no :=
        'RAP-INQ-' ||
        lpad(nextval('public.rapidlyon_inquiry_serial_seq')::text, 6, '0');

    ELSIF TG_TABLE_NAME = 'discovery_submissions' THEN
      NEW.serial_no :=
        'RAP-DSC-' ||
        lpad(nextval('public.rapidlyon_discovery_serial_seq')::text, 6, '0');

    ELSIF TG_TABLE_NAME = 'project_proposals' THEN
      NEW.proposal_number :=
        'RAP-PRP-' ||
        lpad(nextval('public.rapidlyon_proposal_serial_seq')::text, 6, '0');

    ELSIF TG_TABLE_NAME = 'invoices' THEN
      NEW.invoice_number :=
        'RAP-INV-' ||
        lpad(nextval('public.rapidlyon_invoice_serial_seq')::text, 6, '0');

    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_agreement_acceptance_and_issue_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_snapshot jsonb;
BEGIN
  SELECT proposal.accepted_snapshot
    INTO v_snapshot
  FROM public.project_proposals proposal
  WHERE proposal.id = NEW.proposal_id
    AND proposal.client_id = NEW.client_id
    AND proposal.project_id = NEW.project_id
    AND proposal.status = 'accepted'
    AND proposal.accepted_snapshot IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accepted_proposal_snapshot_required';
  END IF;

  INSERT INTO public.commercial_financial_events (
    event_type, client_id, agreement_id, amount, currency, details
  ) VALUES (
    'agreement_accepted', NEW.client_id, NEW.id,
    (v_snapshot->>'amount')::numeric(12, 2),
    pg_catalog.btrim(v_snapshot->>'currency'),
    pg_catalog.jsonb_build_object(
      'accepted_by_auth_user_id', NEW.accepted_by_auth_user_id,
      'accepted_at', NEW.accepted_at,
      'proposal_id', NEW.proposal_id,
      'version', NEW.version
    )
  );

  PERFORM public.issue_agreement_installment_invoice(
    NEW.id,
    1::smallint,
    NULL::uuid
  );

  RETURN NEW;
END;
$function$;