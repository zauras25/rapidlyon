-- Run only against an authorized staging database. This test reads schema
-- metadata and privileges; its temporary results and pgTAP state are rolled back.
BEGIN;

CREATE TEMP TABLE billing_schema_contract_results (
  assertion_number integer PRIMARY KEY,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL'))
) ON COMMIT DROP;

DO $billing_schema_contract$
DECLARE
  assertion record;
  tap_line text;
BEGIN
  PERFORM extensions.plan(22);

  FOR assertion IN
    SELECT checks.assertion_number, checks.description, checks.passed
    FROM (VALUES
      (
        1,
        'invoice installment sequence column exists',
        pg_catalog.to_regclass('public.invoices') is not null
          and exists (
            select 1 from pg_catalog.pg_attribute
            where attrelid = 'public.invoices'::regclass
              and attname = 'installment_sequence'
              and not attisdropped
          )
      ),
      (
        2,
        'invoice installment stage column exists',
        exists (
          select 1 from pg_catalog.pg_attribute
          where attrelid = 'public.invoices'::regclass
            and attname = 'installment_stage'
            and not attisdropped
        )
      ),
      (
        3,
        'financial audit table exists',
        pg_catalog.to_regclass('public.commercial_financial_events') is not null
      ),
      (
        4,
        'invoice issuance is unique per agreement and installment',
        pg_catalog.to_regclass('public.invoices_agreement_installment_unique_idx') is not null
      ),
      (
        5,
        'provider transaction IDs have a unique index',
        pg_catalog.to_regclass('public.invoice_payments_provider_transaction_idx') is not null
      ),
      (
        6,
        'proposal acceptance RPC exists',
        pg_catalog.to_regprocedure('public.accept_project_proposal(uuid)') is not null
      ),
      (
        7,
        'agreement acceptance RPC exists',
        pg_catalog.to_regprocedure('public.accept_project_agreement(uuid)') is not null
      ),
      (
        8,
        'installment invoice issuance RPC exists',
        pg_catalog.to_regprocedure('public.issue_agreement_installment_invoice(uuid,smallint,uuid)') is not null
      ),
      (
        9,
        'payment attempt RPC exists',
        pg_catalog.to_regprocedure('public.create_invoice_payment_attempt(uuid,uuid,text,text)') is not null
      ),
      (
        10,
        'verified payment reconciliation RPC exists',
        pg_catalog.to_regprocedure('public.process_commercial_payment_event(text,text,text,uuid,text,text,text,numeric,text)') is not null
      ),
      (
        11,
        'agreement acceptance is connected to advance invoice issuance',
        exists (
          select 1 from pg_catalog.pg_trigger
          where tgrelid = 'public.project_agreements'::regclass
            and tgname = 'commercial_agreement_acceptance_invoice'
            and not tgisinternal
        )
      ),
      (
        12,
        'milestone approval is connected to installment issuance',
        exists (
          select 1 from pg_catalog.pg_trigger
          where tgrelid = 'public.project_milestones'::regclass
            and tgname = 'commercial_milestone_installment_invoices'
            and not tgisinternal
        )
      ),
      (
        13,
        'installment total check is deferred until transaction completion',
        exists (
          select 1 from pg_catalog.pg_trigger
          where tgrelid = 'public.invoices'::regclass
            and tgname = 'contract_installment_total_check'
            and tgdeferrable
            and tginitdeferred
            and not tgisinternal
        )
      ),
      (
        14,
        'financial audit table has row-level security enabled',
        (select relrowsecurity from pg_catalog.pg_class where oid = 'public.commercial_financial_events'::regclass)
      ),
      (
        15,
        'anonymous role cannot read financial audit events',
        not pg_catalog.has_table_privilege('anon', 'public.commercial_financial_events', 'select')
      ),
      (
        16,
        'authenticated role cannot forge financial audit events',
        not pg_catalog.has_table_privilege('authenticated', 'public.commercial_financial_events', 'insert')
      ),
      (
        17,
        'service role can read financial audit events',
        pg_catalog.has_table_privilege('service_role', 'public.commercial_financial_events', 'select')
      ),
      (
        18,
        'service role can append financial audit events',
        pg_catalog.has_table_privilege('service_role', 'public.commercial_financial_events', 'insert')
      ),
      (
        19,
        'authenticated users cannot call the privileged payment attempt RPC',
        not pg_catalog.has_function_privilege(
          'authenticated',
          'public.create_invoice_payment_attempt(uuid,uuid,text,text)',
          'execute'
        )
      ),
      (
        20,
        'service role can call the payment attempt RPC',
        pg_catalog.has_function_privilege(
          'service_role',
          'public.create_invoice_payment_attempt(uuid,uuid,text,text)',
          'execute'
        )
      ),
      (
        21,
        'anonymous users cannot accept agreements',
        not pg_catalog.has_function_privilege(
          'anon',
          'public.accept_project_agreement(uuid)',
          'execute'
        )
      ),
      (
        22,
        'invoice installment sequence and stage are constrained together',
        exists (
          select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.invoices'::regclass
            and conname = 'invoices_installment_pair_check'
        )
      )
    ) AS checks(assertion_number, description, passed)
    ORDER BY checks.assertion_number
  LOOP
    tap_line := extensions.ok(assertion.passed, assertion.description);

    INSERT INTO pg_temp.billing_schema_contract_results (
      assertion_number,
      description,
      status
    )
    VALUES (
      assertion.assertion_number,
      assertion.description,
      CASE WHEN tap_line LIKE 'ok %' THEN 'PASS' ELSE 'FAIL' END
    );
  END LOOP;

  PERFORM extensions.finish();
END;
$billing_schema_contract$;

SELECT
  results.assertion_number AS number,
  results.description,
  results.status,
  NULL::integer AS passed,
  NULL::integer AS failed
FROM pg_temp.billing_schema_contract_results AS results

UNION ALL

SELECT
  NULL::integer AS number,
  'TOTAL'::text AS description,
  CASE
    WHEN count(*) FILTER (WHERE results.status = 'FAIL') = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  count(*) FILTER (WHERE results.status = 'PASS')::integer AS passed,
  count(*) FILTER (WHERE results.status = 'FAIL')::integer AS failed
FROM pg_temp.billing_schema_contract_results AS results

ORDER BY number NULLS LAST;

ROLLBACK;
