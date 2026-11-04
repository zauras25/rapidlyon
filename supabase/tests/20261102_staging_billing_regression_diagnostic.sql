BEGIN;

CREATE TEMP TABLE billing_qa_results (
    result text NOT NULL
) ON COMMIT DROP;

GRANT INSERT, SELECT
ON pg_temp.billing_qa_results
TO PUBLIC;

CREATE TEMP TABLE billing_test_state (
  auth_user_id uuid,
  client_id uuid,
  project_id uuid,
  proposal_id uuid,
  agreement_id uuid,
  milestone_zero_id uuid,
  milestone_one_id uuid,
  final_milestone_id uuid
) ON COMMIT DROP;
GRANT SELECT ON billing_test_state TO authenticated, anon, service_role;

SELECT extensions.plan(21);

WITH auth_seed AS (
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at, invited_at,
    is_anonymous, is_sso_user, deleted_at, last_sign_in_at
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    format('billing-%s@example.invalid', replace(gen_random_uuid()::text, '-', '')),
    'not-a-login-credential',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    '',
    now(),
    '',
    now(),
    '',
    '',
    now(),
    now(),
    false,
    false,
    null,
    now()
  )
  RETURNING id AS auth_user_id, email
),
client_seed AS (
  INSERT INTO public.clients (id, name, email, company, status, auth_user_id)
  SELECT gen_random_uuid(), 'Billing Fixture Client', auth_seed.email, 'QA Fixture', 'active', auth_seed.auth_user_id
  FROM auth_seed
  RETURNING id AS client_id, auth_user_id
),
project_seed AS (
  INSERT INTO public.client_projects (
    id, client_id, name, service_type, status, agreed_price, currency,
    package_snapshot, agreed_scope
  )
  SELECT
    gen_random_uuid(), client_seed.client_id, 'Billing Fixture Project',
    'Product Design', 'active', 12345.67, 'USD',
    '{"name":"billing-qa","currency":"USD"}'::jsonb,
    '{"summary":"transaction-scoped billing QA fixture"}'::jsonb
  FROM client_seed
  RETURNING id AS project_id, client_id
),
proposal_seed AS (
  INSERT INTO public.project_proposals (
    id, proposal_number, client_id, project_id, title, summary, scope,
    deliverables, exclusions, timeline, milestones, payment_schedule,
    amount, currency, notes, status, expires_at, sent_at
  )
  SELECT
    gen_random_uuid(),
    format('QA-%s', replace(gen_random_uuid()::text, '-', '')),
    project_seed.client_id,
    project_seed.project_id,
    'Billing lifecycle fixture',
    'Synthetic transactional billing test',
    '{"summary":"billing fixture"}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"start":"2026-11-02","end":"2026-12-31"}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('title', 'Discovery'),
      jsonb_build_object('title', 'Design system'),
      jsonb_build_object('title', 'Launch and QA')
    ),
    jsonb_build_array(
      jsonb_build_object(
        'sequence', 1, 'stage', 'advance', 'percentage', 40,
        'amount', '4938.27', 'currency', 'USD',
        'dueTrigger', 'After agreement acceptance and before project kickoff.'
      ),
      jsonb_build_object(
        'sequence', 2, 'stage', 'agreed_milestone', 'percentage', 30,
        'amount', '3703.70', 'currency', 'USD',
        'dueTrigger', 'At the milestone identified in the accepted agreement.',
        'milestone_position', 2
      ),
      jsonb_build_object(
        'sequence', 3, 'stage', 'final', 'percentage', 30,
        'amount', '3703.70', 'currency', 'USD',
        'dueTrigger', 'After final approval and before handover.'
      )
    ),
    12345.67,
    'USD',
    'Synthetic billing QA fixture',
    'sent',
    now() + interval '30 days',
    now()
  FROM project_seed
  RETURNING id AS proposal_id, client_id, project_id
)
INSERT INTO billing_test_state (auth_user_id, client_id, project_id, proposal_id)
SELECT auth_seed.auth_user_id, client_seed.client_id, project_seed.project_id, proposal_seed.proposal_id
FROM auth_seed
JOIN client_seed ON client_seed.auth_user_id = auth_seed.auth_user_id
JOIN project_seed ON project_seed.client_id = client_seed.client_id
JOIN proposal_seed ON proposal_seed.project_id = project_seed.project_id;

INSERT INTO public.project_milestones (id, project_id, title, description, position, status)
SELECT gen_random_uuid(), project_id, 'Discovery', 'Synthetic completed stage', 0, 'client_review'
FROM billing_test_state
UNION ALL
SELECT gen_random_uuid(), project_id, 'Design system', 'Agreed invoice milestone', 1, 'client_review'
FROM billing_test_state
UNION ALL
SELECT gen_random_uuid(), project_id, 'Launch and QA', 'Final invoice milestone', 2, 'upcoming'
FROM billing_test_state;

UPDATE billing_test_state AS state
SET milestone_zero_id = (
      SELECT id FROM public.project_milestones
      WHERE project_id = state.project_id AND position = 0
    ),
    milestone_one_id = (
      SELECT id FROM public.project_milestones
      WHERE project_id = state.project_id AND position = 1
    ),
    final_milestone_id = (
      SELECT id FROM public.project_milestones
      WHERE project_id = state.project_id AND position = 2
    );

INSERT INTO public.project_agreements (
  id, client_id, project_id, proposal_id, version, terms, status, sent_at
)
SELECT
  gen_random_uuid(), client_id, project_id, proposal_id, 1,
  'Synthetic agreement for transactional billing QA.', 'sent', now()
FROM billing_test_state;

UPDATE billing_test_state AS state
SET agreement_id = agreement.id
FROM public.project_agreements AS agreement
WHERE agreement.project_id = state.project_id
  AND agreement.proposal_id = state.proposal_id;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT amount = 12345.67
      AND round(amount * 0.40, 2) = 4938.27
      AND round(amount * 0.30, 2) = 3703.70
      AND amount - round(amount * 0.40, 2) - round(amount * 0.30, 2) = 3703.70
   FROM public.project_proposals
   WHERE id = (SELECT proposal_id FROM billing_test_state))
  AND (SELECT count(*) = 3
       FROM public.project_milestones
       WHERE project_id = (SELECT project_id FROM billing_test_state)),
  'fixture uses the migration schedule rounding and one-based milestone position'
);

SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT auth_user_id::text FROM billing_test_state),
  true
);
SET LOCAL ROLE authenticated;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.accept_project_proposal(
    (SELECT proposal_id FROM billing_test_state)
  )->>'proposal_id')::uuid = (SELECT proposal_id FROM billing_test_state),
  'authenticated client accepts the proposal and creates the immutable accepted snapshot'
);

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.accept_project_agreement(
    (SELECT agreement_id FROM billing_test_state)
  )->>'agreement_id')::uuid = (SELECT agreement_id FROM billing_test_state),
  'authenticated client acceptance triggers the first installment and acceptance audit'
);

RESET ROLE;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 1
      AND min(installment_sequence) = 1
      AND min(installment_stage) = 'advance'
      AND min(total) = 4938.27
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state))
  AND EXISTS (
    SELECT 1 FROM public.commercial_financial_events
    WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
      AND event_type = 'agreement_accepted'
      AND amount = 12345.67
  ),
  'agreement acceptance issues exactly one rounded 40% advance invoice and records its audit event'
);

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT sum(total) = 4938.27
      AND count(*) FILTER (WHERE installment_sequence > 1) = 0
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)),
  'issued total is 40% until the agreed milestone is approved'
);

DO $test$
DECLARE
  v_state text;
  v_message text;
BEGIN
  BEGIN
    PERFORM public.issue_agreement_installment_invoice(
      (SELECT agreement_id FROM billing_test_state),
      2::smallint,
      (SELECT milestone_one_id FROM billing_test_state)
    );
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(false, 'sequence 2 is rejected before milestone approval');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
      v_state = 'P0001' AND v_message = 'installment_milestone_not_approved',
      'sequence 2 is rejected only for the expected unapproved-milestone reason'
    );
  END;
END
$test$;

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT milestone_zero_id FROM billing_test_state),
    'approve'
  )->>'outcome') = 'transitioned',
  'an earlier approval does not issue the later scheduled invoice'
);
RESET ROLE;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 0
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
     AND installment_sequence = 2),
  'approval before the scheduled milestone does not create installment 2'
);

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT milestone_one_id FROM billing_test_state),
    'approve'
  )->>'outcome') = 'transitioned',
  'approval of one-based scheduled milestone 2 triggers installment 2'
);
RESET ROLE;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 1
      AND min(installment_stage) = 'agreed_milestone'
      AND min(total) = 3703.70
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
     AND installment_sequence = 2)
  AND (SELECT sum(total) = 8641.97
       FROM public.invoices
       WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)),
  'second invoice is exactly 30% and cumulative invoicing is exactly 70%'
);

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT milestone_one_id FROM billing_test_state),
    'approve'
  )->>'outcome') = 'conflict',
  're-approving the same milestone is rejected as a state conflict'
);
RESET ROLE;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 1
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
     AND installment_sequence = 2),
  'repeated milestone approval does not duplicate installment 2'
);

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT milestone_one_id FROM billing_test_state),
    'complete'
  )->>'outcome') = 'transitioned'
  AND (SELECT count(*) = 1
       FROM public.invoices
       WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
         AND installment_sequence = 2)
  AND (SELECT status = 'active'
       FROM public.project_milestones
       WHERE id = (SELECT final_milestone_id FROM billing_test_state)),
  'a later status update re-enters the invoice trigger idempotently and starts the final milestone'
);
RESET ROLE;

SET LOCAL ROLE service_role;
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT final_milestone_id FROM billing_test_state),
    'submit_for_review'
  )->>'outcome') = 'transitioned',
  'final active milestone is submitted through the real review transition'
);
INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (public.transition_project_milestone(
    (SELECT project_id FROM billing_test_state),
    (SELECT final_milestone_id FROM billing_test_state),
    'approve'
  )->>'outcome') = 'transitioned',
  'final milestone approval triggers the final installment'
);
RESET ROLE;

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 1
      AND min(installment_stage) = 'final'
      AND min(total) = 3703.70
   FROM public.invoices
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
     AND installment_sequence = 3)
  AND (SELECT count(*) = 3 AND sum(total) = 12345.67
       FROM public.invoices
       WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)),
  'final invoice is the rounded 30% remainder and cumulative invoicing is exactly 100%'
);

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 3
      AND bool_and(invoice.id = public.issue_agreement_installment_invoice(
        invoice.agreement_id,
        invoice.installment_sequence,
        CASE invoice.installment_sequence
          WHEN 2 THEN (SELECT milestone_one_id FROM billing_test_state)
          WHEN 3 THEN (SELECT final_milestone_id FROM billing_test_state)
          ELSE null
        END
      ))
   FROM public.invoices AS invoice
   WHERE invoice.agreement_id = (SELECT agreement_id FROM billing_test_state)),
  'all installment issuance calls return their existing invoice without duplication'
);

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT count(*) = 4
   FROM public.commercial_financial_events
   WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
     AND event_type IN ('agreement_accepted', 'installment_invoice_issued'))
  AND (SELECT count(*) = 3
       FROM public.commercial_financial_events
       WHERE agreement_id = (SELECT agreement_id FROM billing_test_state)
         AND event_type = 'installment_invoice_issued'
         AND amount IN (4938.27, 3703.70)),
  'financial audit records contain acceptance and exactly three installment issuance events'
);

INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
  (SELECT agreement.status = 'accepted'
      AND agreement.accepted_by_auth_user_id = state.auth_user_id
      AND proposal.status = 'accepted'
      AND proposal.accepted_snapshot->>'amount' = '12345.67'
   FROM billing_test_state AS state
   JOIN public.project_agreements AS agreement ON agreement.id = state.agreement_id
   JOIN public.project_proposals AS proposal ON proposal.id = state.proposal_id),
  'agreement and proposal states record the authenticated acceptance identity and snapshot'
);

SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_state text;
BEGIN
  BEGIN
    PERFORM public.process_commercial_payment_event(
      'test', 'forbidden-event', 'payment.updated', gen_random_uuid(),
      'transaction', 'paid', 'card', 1.00, 'USD'
    );
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(false, 'authenticated users cannot call payment reconciliation');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
      v_state = '42501',
      'payment reconciliation is denied specifically by function privileges'
    );
  END;
END
$test$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $test$
DECLARE
  v_state text;
BEGIN
  BEGIN
    PERFORM public.accept_project_agreement(
      (SELECT agreement_id FROM billing_test_state)
    );
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(false, 'anonymous users cannot accept an agreement');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO pg_temp.billing_qa_results(result) SELECT extensions.ok(
      v_state = '42501',
      'anonymous agreement acceptance is denied specifically by function privileges'
    );
  END;
END
$test$;
RESET ROLE;

SELECT extensions.finish();

WITH results AS (
    SELECT
        (regexp_match(
            result,
            '^(?:not )?ok[[:space:]]+([0-9]+)'
        ))[1]::integer AS test_number,
        result,
        CASE
            WHEN result ~ '^ok[[:space:]]+[0-9]+'
            THEN 'PASS'
            ELSE 'FAIL'
        END AS status
    FROM pg_temp.billing_qa_results
),
report AS (
    SELECT
        test_number AS sort_order,
        test_number::text AS test,
        regexp_replace(
            result,
            '^(not )?ok[[:space:]]+[0-9]+[[:space:]]*-[[:space:]]*',
            ''
        ) AS assertion,
        status,
        1::bigint AS executed,
        CASE WHEN status = 'PASS' THEN 1 ELSE 0 END::bigint AS passed,
        CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END::bigint AS failed
    FROM results

    UNION ALL

    SELECT
        999,
        'TOTAL',
        'Post-migration billing regression',
        CASE
            WHEN count(*) = 21
             AND count(*) FILTER (WHERE status = 'PASS') = 21
             AND count(DISTINCT test_number) = 21
             AND min(test_number) = 1
             AND max(test_number) = 21
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        count(*),
        count(*) FILTER (WHERE status = 'PASS'),
        count(*) FILTER (WHERE status = 'FAIL')
    FROM results
)
SELECT test, assertion, status, executed, passed, failed
FROM report
ORDER BY sort_order;

ROLLBACK;