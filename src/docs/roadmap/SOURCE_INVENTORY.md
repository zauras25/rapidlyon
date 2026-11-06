# RapidlyOn source inventory

Generated from supplied original ZIP plus roadmap changes. This is not a deployed schema verification.

## Supabase migrations (30)

- `supabase/migrations/20261023000100_create_inquiries.sql`
- `supabase/migrations/20261023000200_create_work_projects_and_media.sql`
- `supabase/migrations/20261023000300_create_discovery_submissions.sql`
- `supabase/migrations/20261023000400_create_client_delivery_foundation.sql`
- `supabase/migrations/20261023000500_create_project_reviews.sql`
- `supabase/migrations/20261023000600_create_project_invitation_rpc.sql`
- `supabase/migrations/20261023000700_add_discovery_follow_up_fields.sql`
- `supabase/migrations/20261023000800_add_discovery_notification_fields.sql`
- `supabase/migrations/20261023000900_manage_project_reviews.sql`
- `supabase/migrations/20261023001000_add_client_identity_and_ownership.sql`
- `supabase/migrations/20261023001100_add_project_milestone_lifecycle.sql`
- `supabase/migrations/20261023001200_add_deliverable_review_workflow.sql`
- `supabase/migrations/20261023001300_add_scope_changes_and_project_handoff.sql`
- `supabase/migrations/20261023001400_add_project_review_linkage_and_discovery_access.sql`
- `supabase/migrations/20261023001500_guard_project_invitation_commercial_terms.sql`
- `supabase/migrations/20261023001600_guard_project_commercial_activation.sql`
- `supabase/migrations/20261023001700_add_authenticated_discovery_and_milestone_approvals.sql`
- `supabase/migrations/20261023001800_create_commercial_records.sql`
- `supabase/migrations/20261023001900_commercial_workflow_functions.sql`
- `supabase/migrations/20261023002000_commercial_acceptance_snapshot.sql`
- `supabase/migrations/20261027000100_inquiry_workflow.sql`
- `supabase/migrations/20261027000200_admin_record_history.sql`
- `supabase/migrations/20261027000300_inquiry_messages.sql`
- `supabase/migrations/20261027000400_record_lifecycle.sql`
- `supabase/migrations/20261027000500_business_serial_numbers.sql`
- `supabase/migrations/20261027000600_discovery_work_scopes.sql`
- `supabase/migrations/20261028000100_draft_milestone_editor.sql`
- `supabase/migrations/20261029000100_link_inquiry_discovery.sql`
- `supabase/migrations/20261029000200_followup_dispatch.sql`
- `supabase/migrations/20261029000300_inquiry_idempotency.sql`

## API routes (50)

- `/api/admin/action-center`
- `/api/admin/client-projects/[projectId]/invitation`
- `/api/admin/client-projects/[projectId]`
- `/api/admin/client-projects`
- `/api/admin/commercial/[kind]/[id]`
- `/api/admin/commercial`
- `/api/admin/deliverables/[deliverableId]`
- `/api/admin/discovery/[id]/attachments`
- `/api/admin/discovery/[id]/notification`
- `/api/admin/discovery/[id]/project`
- `/api/admin/discovery/[id]`
- `/api/admin/discovery/[id]/scope`
- `/api/admin/discovery`
- `/api/admin/inquiries/[id]/invite`
- `/api/admin/inquiries/[id]/messages`
- `/api/admin/inquiries/[id]/reply`
- `/api/admin/inquiries/[id]`
- `/api/admin/inquiries`
- `/api/admin/leads/[id]/timeline`
- `/api/admin/operations`
- `/api/admin/pipeline-counts`
- `/api/admin/projects/[slug]/complete`
- `/api/admin/projects/[slug]/milestone-drafts`
- `/api/admin/projects/[slug]/milestones/[milestoneId]`
- `/api/admin/projects/[slug]`
- `/api/admin/projects/[slug]/scope-changes/[changeId]`
- `/api/admin/projects`
- `/api/admin/projects/upload`
- `/api/admin/record-events`
- `/api/admin/record-lifecycle/[kind]/[id]`
- `/api/admin/reviews/[id]`
- `/api/admin/reviews`
- `/api/admin/session`
- `/api/client/commercial`
- `/api/client/deliverables/[deliverableId]/review`
- `/api/client/invitations/accept`
- `/api/client/invoices/[invoiceId]/payment`
- `/api/client/projects/[projectId]/milestones/[milestoneId]/approval`
- `/api/client/projects/[projectId]/review`
- `/api/client/projects/[projectId]/scope-changes`
- `/api/client/receipts/[paymentId]`
- `/api/client/workspace`
- `/api/cron/follow-ups`
- `/api/discovery/invite`
- `/api/discovery`
- `/api/inquiries`
- `/api/request-status`
- `/api/reviews`
- `/api/webhooks/resend-inquiry`
- `/api/webhooks/safepay`
