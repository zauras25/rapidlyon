# Rapidlyon

Rapidlyon is a premium digital design and development studio website built with **Next.js App Router, TypeScript, and Tailwind CSS**.

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the sample environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env.local
```

### 3. Start the Development Server

```bash
npm run dev
```

## Environment Variables

Project inquiries, moderated reviews, and discovery submissions use Supabase's server-side REST API.

Apply all SQL migrations in `supabase/migrations/`, then configure the following server-only credentials in `.env.local`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Supabase Security

`SUPABASE_SERVICE_ROLE_KEY` must be the Supabase **secret/service-role key**, not a publishable key.

- Keep the service-role key private.
- Never expose it using a `NEXT_PUBLIC_` prefix.
- Public keys currently prefixed with `sb_publishable_` cannot perform the privileged server-side database and storage operations used by these routes.
- Without the correct server URL and service-role key, the form reports that the inquiry was not sent and offers the studio email as an alternative.
- A success message is displayed only after Supabase confirms the database insert.

If browser-side Supabase access is required, configure these variables separately:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The publishable key is intended for public/client-side use. It does not replace the server-only service-role key.

### Canonical Website URL

Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin for the production deployment.

```env
NEXT_PUBLIC_SITE_URL=https://rapidlyon.com
```

Replace the example domain if necessary. Keep this value aligned with the domain serving the website. It is used for canonical metadata, sitemap URLs, and the metadata base.

## Business and Project Discovery

### Discovery Flow

The guided client flow is available at:

- `/discovery` — project discovery form
- `/start-project` — redirects to `/discovery`

The discovery flow supports:

- Saving text answers in browser-local storage.
- Clearing a saved draft.
- Uploading up to three private attachments.
- PDF, JPG, PNG, and WebP file formats.
- A maximum file size of 5 MB per attachment.
- Persisting successful submissions to `public.discovery_submissions`.

The latest migration creates the discovery submissions table and the private `discovery-attachments` Supabase Storage bucket.

Direct anonymous or authenticated table/storage access is not granted. The application uses the server-only service-role key after validating each request.

### Admin Discovery Area

The private, single-operator discovery area is available at:

`/admin/discovery`

`/admin` redirects to the existing sign-in page when unauthenticated and to the Admin Operations dashboard after authentication. Discovery, Reviews, and operations use the same signed admin session.

Configure the following server-only environment variables:

```env
DISCOVERY_ADMIN_PASSWORD=<a unique password of at least 16 characters>
DISCOVERY_SESSION_SECRET=<a cryptographically random secret of at least 32 characters>
```

The same sign-in protects `/admin/reviews`. Configure these values on the web-app host (for example, the Vercel project environment settings), not in Supabase. For local development, add them to `.env.local` and restart `npm run dev`.

The admin login is enabled only when these credentials and the server-side Supabase connection are configured. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the web-app host as described in [Supabase Security](#supabase-security). The service-role key is available in the Supabase project API key settings; it must remain server-only and must never use a `NEXT_PUBLIC_` prefix.

Security requirements:

- Use a unique, strong admin password.
- Use a cryptographically random session secret.
- Keep both values private.
- Change the admin password if access may have been exposed.

The admin session uses an **HttpOnly, SameSite=Strict signed cookie** that expires after eight hours.

The admin interface supports a manual workflow for recording:

- Request status
- Next action
- Follow-up date
- Private notes

Assign an owner to review every new request, record the next action and follow-up date, and follow up manually.

The admin area is not a general-purpose CMS or a multi-user authentication system.

### Portfolio Project CMS

The private portfolio hub is available at `/admin/projects` using the same admin sign-in. It opens three separate workflows:

- `/admin/projects/product-design` — an ordered Product Design story: Discovery, Define, Information Architecture, Wireframes, UI Design, Design Audit, Prototype & Testing, and Developer Handoff. Every stage has its own summary, decision list, and images; the hero image is managed separately.
- `/admin/projects/development` — a separate engineering lifecycle: Brief & Scope, Technical Approach, Implementation, Integrations, Quality Assurance, and Deployment & Handoff, with evidence images attached to each stage.
- `/admin/projects/seo` — an SEO engagement page with audit scope, site context, verified findings, evidence limitations, and audit screenshot uploads.

All three workflows can create, edit, publish, save drafts, and delete portfolio projects. Product Design and Development can be joined as a combined engagement; both sets of case-study stages are then captured. SEO projects require a summary and at least one verifiable finding before publishing.

Apply `supabase/migrations/create_work_projects_and_media.sql` to the configured Supabase project before using the CMS. The migration creates the RLS-protected `work_projects` table and a public-read `work-project-media` bucket for portfolio images (JPG, PNG, WebP, or AVIF, up to 5 MB each). Only the server-side admin API can write project records or upload/delete media. Do not add a browser/public write policy or expose the service-role key.

No additional environment variables are required: configure the existing `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `DISCOVERY_ADMIN_PASSWORD`, and `DISCOVERY_SESSION_SECRET` described above. In production, also configure the existing Upstash rate-limit variables required by the protected admin write and upload routes.

Existing built-in projects appear in the project manager and remain public until changed there. Saving one creates a database override; deleting one records a hidden/tombstone entry so it does not reappear from the built-in fallback. Newly published database projects appear on `/work`, their case-study routes, and the sitemap. Public project data refreshes immediately after admin changes, with a short cached-data revalidation interval as a fallback. If the migration or Supabase connection is unavailable, the public site continues to serve its built-in project content; the admin reports that projects cannot be loaded.

### Discovery Categories

The discovery form supports these primary service categories:

1. Product Design
2. Next.js Development
3. SEO
4. Other / not sure yet

Product Design and Next.js Development can be selected together as a combined engagement; the combination is not a separate service. Existing legacy service values remain readable in stored submissions and browser drafts.


### Lead Qualification and Project Agreements

An inquiry or discovery request is a lead, not an accepted project.

Before accepting work, define the following in writing:

- Project objective
- Deliverables and exclusions
- Assumptions and dependencies
- Milestones and estimated timeline
- Price and revision allowance
- Approval responsibilities
- Client responsibilities

Review the effect of any change request on cost and schedule, and obtain written approval before proceeding.

Work begins only after the agreement and payment terms are accepted.

The website does not generate or accept proposals or contracts.

### Client Delivery Data Foundation

Apply `supabase/migrations/create_client_delivery_foundation.sql` after the existing discovery migrations. It adds `clients`, `client_projects`, `project_milestones`, `project_deliverables`, `project_invitations`, and `project_activity`, and adds optional qualification, client, and project links to `discovery_submissions`. A lead remains a lead until explicitly qualified and linked; existing discovery statuses and portfolio `work_projects` are unchanged.

For a fresh client-delivery database, apply the related migrations in this order:

1. `create_discovery_submissions.sql`
2. `add_discovery_follow_up_fields.sql`
3. `add_discovery_notification_fields.sql`
4. `create_client_delivery_foundation.sql`
5. `add_client_identity_and_ownership.sql`
6. `add_project_milestone_lifecycle.sql`
7. `add_authenticated_discovery_and_milestone_approvals.sql`
8. `add_deliverable_review_workflow.sql`
9. `add_scope_changes_and_project_handoff.sql`
10. `create_project_reviews.sql`
11. `manage_project_reviews.sql`
12. `add_project_review_linkage_and_discovery_access.sql`

`create_inquiries.sql` and `create_work_projects_and_media.sql` support separate public-site features. Apply them for those features; they are not dependencies of client delivery.

Pricing is currently defined in application code rather than a database package table. `client_projects.package_key` can identify a selected definition, while `package_snapshot`, `agreed_price`, `currency`, and `agreed_scope` preserve the commercial terms for that project instead of resolving them from future pricing edits. Invitation secrets must be stored as SHA-256 hex digests in `project_invitations.token_hash`, never as raw tokens.

The delivery foundation initially denies direct `anon` and `authenticated` access. The follow-up identity migration adds Supabase Auth UUID ownership and read-only, owner-scoped RLS policies; invitation rows remain inaccessible to client sessions. Keep the service-role key server-only and continue checking the admin session in administrative routes.

### Client Identity and Invitation Acceptance

Apply `supabase/migrations/add_client_identity_and_ownership.sql` after the client delivery foundation migration. Client identities use Supabase Auth UUIDs through `clients.auth_user_id`; clients must have a confirmed email matching both the invitation and client record. The server-only `POST /api/client/invitations/accept` endpoint requires a Supabase Auth bearer access token and accepts a raw invitation token only in its bounded HTTPS request body. It hashes the token before calling a service-role-only database function, which locks and validates the invitation, links the Auth UUID, marks the invitation accepted, activates an invited project, and records an activity entry atomically.

The migration adds authenticated read-only RLS policies for a client's own client record, projects, milestones, deliverables, and activity. Client writes and all invitation-table access remain denied; administrative/server routes continue to use the server-only service role and their existing admin session checks. `src/lib/client-auth.ts` provides server-side Auth verification and client/project/milestone/deliverable ownership checks. Configure Supabase Auth email confirmation before clients register. The invitation token must be generated with at least 32 URL-safe characters and only its SHA-256 hex digest is stored.

Clients can create an account or sign in at `/client/login`. Password recovery is available at `/client/forgot-password`; the Supabase Auth recovery redirect must allow the site's `/client/reset-password` URL. A verified account is required to submit `/discovery`; requests are linked to that account and their status, next action, and follow-up date appear in `/client`. Passwords are managed by Supabase Auth and are never emailed by the application.

From an authenticated discovery submission, an administrator can create and link a client project with an agreed overview and milestone plan. The client sees the linked project in `/client`; administrators manage delivery milestones at `/admin/clients`.

### Milestone Lifecycle

Apply `supabase/migrations/add_project_milestone_lifecycle.sql` after the client identity migration. It adds an atomic, service-role-only `transition_project_milestone` database function and activity event types for milestone start, review submission, and approval. Apply `supabase/migrations/add_authenticated_discovery_and_milestone_approvals.sql` after the client delivery foundation and milestone lifecycle migrations. It securely links verified client accounts to discovery requests, enables owner-only reads of those requests, and adds separate client/admin approval timestamps for each milestone.

The admin-only `PATCH /api/admin/projects/{projectId}/milestones/{milestoneId}` endpoint accepts `start`, `submit_for_review`, `approve`, or `complete`; `/admin/clients` provides the admin controls. Clients confirm a milestone from their workspace. A milestone is not marked approved until both client and admin confirmations are recorded, regardless of order, and it cannot be completed before both approvals. Completing a milestone starts the next eligible upcoming milestone. Project completion is an explicit, separately guarded handoff action.

Workspace progress is calculated once by `src/lib/project-milestones.ts`: a milestone counts complete only when approved or completed, with zero of zero milestones reported as 0%. The same helper selects the active, review, or next upcoming milestone and prepares the next-stage message for the client workspace.

### Deliverable Review

Apply `supabase/migrations/add_deliverable_review_workflow.sql` after the client delivery foundation, client identity, milestone lifecycle, and authenticated discovery/milestone approval migrations. It adds client-visible, deliverable-specific feedback and state-checked database transitions; it does not create a second deliverables table.

Clients can approve a deliverable or request changes with a required message of at least 10 non-whitespace characters from `/client`. Previous feedback remains visible after the studio resubmits the deliverable. The admin-only `GET /api/admin/deliverables/{deliverableId}` endpoint returns the current deliverable and its feedback history; the matching `PATCH` endpoint accepts `start`, `ready_for_review`, or `complete` actions. Both endpoints require the existing admin session.

When a milestone has deliverables, it cannot enter client review until each deliverable is ready for review or already approved, and it cannot be approved or completed until all linked deliverables are approved or completed. A client change request returns a milestone from review to active work and clears its previous client/admin milestone confirmations. Milestones without deliverables keep the existing lifecycle.

### Scope Changes and Project Handoff

Apply `supabase/migrations/add_scope_changes_and_project_handoff.sql` after `supabase/migrations/add_deliverable_review_workflow.sql` (and therefore after the client delivery, identity, lifecycle, and authenticated milestone-approval migrations). Apply it to the configured Supabase project before deploying these routes. No extra credentials or manual data backfill are required.

Scope requests are stored in `project_scope_changes` with the immutable decision path `requested` → `approved` or `rejected`. The original `client_projects.agreed_scope` and package snapshot are not overwritten; approved additions remain separately auditable in the scope-change table. The migration adds owner-only client read access while keeping internal decision notes unavailable to authenticated clients. Client requests and admin decisions run through service-role-only database functions after the existing client-auth or signed-admin-session checks.

The admin can explicitly complete an active project through the operations detail view. Completion is atomic and requires all milestones and deliverables to be completed and no scope request awaiting a decision. The last completed milestone no longer auto-closes the project. A successful transition records `completed_at` and `project_completed`; the client workspace then shows the handoff date, completed work, and approved scope additions. Existing service-role credentials remain server-only.

### Completed Project Reviews and Re-engagement

Apply `supabase/migrations/create_project_reviews.sql` and `supabase/migrations/manage_project_reviews.sql` before `supabase/migrations/add_project_review_linkage_and_discovery_access.sql`. The linkage migration adds optional client/project references to existing `project_reviews`, a unique constraint ensuring at most one active review record per project, and a service-role-only submission function that rechecks ownership and completion atomically. Existing reviews without project links remain valid.

After a project is completed, its authenticated owner may optionally submit a rating and short review in `/client`. The review is stored as `pending` in the existing moderation system; only administrators can change its publication state. Project reviews remain retained for audit, while existing manually managed public reviews keep their current moderation behavior. The admin review list shows linked client/project and submission context, and project operations show review status and content. The client can start another conversation through the existing `/discovery` or `/services` routes; no project, email, or marketing message is created automatically.

The final migration also replaces the table-wide authenticated `SELECT` on `discovery_submissions` with column-level grants for client-safe fields. The existing owner-only RLS policy remains in force; internal notes are not available through direct authenticated table queries.

### Admin Operations

The authenticated `/admin` home shows discovery requests needing qualification, pending invitations, deliverable reviews and change requests, dated milestones due within seven days or overdue, pending public reviews, active/completed project counts, and recent project activity. Project search runs through the authenticated server API and matches project name, client name, and client email. Project details are available at `/admin/operations/projects/{projectId}`; progress/current-milestone summaries use the same `src/lib/project-milestones.ts` helper as the client workspace. Invitation records are shown read-only because no resend or revoke action is configured.

### Booking Configuration

`NEXT_PUBLIC_CALENDLY_URL` is optional.

Without a booking provider configured, interview or demo times are recorded as requests only. The website does not claim that a booking has been confirmed.

### Email Notifications

When Resend is configured, new Discovery leads are emailed to an operator using its transactional email API. The message is sent only after Supabase confirms the lead insert. Provider credentials and the fixed recipient are read only on the server; visitors cannot choose recipients. Notification status is tracked separately from the lead, and an admin can retry a failed or stuck delivery from the submission detail.

Configure these server-only variables on the web-app host and in local `.env.local` for development:

```env
RESEND_API_KEY=
DISCOVERY_NOTIFICATION_TO=
DISCOVERY_NOTIFICATION_FROM=
```

Use a Resend API key, one fixed internal/admin recipient address, and a sender address verified with Resend. The app sends internal notifications only; it does not send automatic visitor confirmations or quotes. A successful form submission confirms that the lead was saved, not that an email was delivered. Check the notification status in `/admin/discovery` if delivery fails.

Apply `supabase/migrations/add_discovery_notification_fields.sql` along with the other migrations before deployment. Existing rows become `pending` and can be retried from the admin after email configuration is complete.

## Rate Limiting and Spam Protection

For application-level distributed rate limiting, configure:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Use an HTTPS Upstash Redis REST endpoint and its corresponding secret token.

The application applies fixed-window limits to:

- Inquiries
- Reviews
- Discovery submissions
- Admin login
- Admin updates
- Notification retries
- Attachment-link requests

### Important Configuration Notes

- Both Upstash variables are required for application-level rate limiting in production. Protected routes fail closed with a temporary service error if the configuration is missing, partial, or unavailable.
- In development only, missing Upstash configuration preserves the local fallback so forms can be tested.
- If Upstash is configured but unavailable, protected write operations fail closed with a temporary service error.
- The hosting platform must provide a trustworthy client IP header for per-client limits.

Supported headers include:

- `cf-connecting-ip`
- `x-real-ip`
- Sanitized `x-forwarded-for`

Configure and verify these protections before production launch.

## HTTP Security Headers

The application sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a restrictive `Permissions-Policy`. Production responses also include HSTS with a one-year max age; deploy the site over HTTPS before enabling production traffic.

A Content Security Policy is not currently configured. The application uses Next.js-generated inline runtime scripts and styles; a strict policy needs a per-request nonce strategy and a verified inventory of required sources. Do not add `unsafe-inline` or deploy a restrictive policy without testing public pages, admin, and production assets/integrations.

## Review Moderation

Reviews are stored in Supabase `public.project_reviews`. Visitor submissions are stored with:

```text
status = 'pending'
```

Apply `supabase/migrations/manage_project_reviews.sql` to an existing database before deploying the review-management interface. It adds display ordering and `updated_at`, preserves existing review records and statuses, and initializes their order with the newest first.

Authenticated administrators can manage records at `/admin/reviews`, using the existing Discovery admin sign-in. The interface supports creating, editing, ordering, publishing, unpublishing (pending/rejected), and deleting reviews. Only `approved` reviews are returned to the public site. Lower display-order numbers appear first; equal order values are sorted newest first.

Published reviews are user-submitted and are **not independently identity-verified**.
Only publish feedback shared with permission. Do not add unsupported names, roles, companies, project relationships, or outcome claims.

Configure rate limiting and spam protection before opening public review submissions in production.

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run the project's lint checks |
| `npx tsc --noEmit` | Check TypeScript types without generating output |

## Testing and Validation

Run the following commands before deployment:

### 1. Lint

```bash
npm run lint
```

### 2. Type Check

```bash
npx tsc --noEmit
```

### 3. Production Build

```bash
npm run build
```

Resolve any errors before deploying.

## Deployment

Deploy Rapidlyon to a Node-compatible hosting provider that supports Next.js, such as Vercel.

### Production Readiness Checklist

#### Environment and Database

- [ ] Apply all Supabase migrations.
- [ ] Verify the database tables and private storage bucket.
- [ ] Configure all required production environment variables.
- [ ] Confirm the Supabase service-role key is kept server-side.
- [ ] Verify database permissions and storage access restrictions.

#### Domain and SEO

- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final canonical HTTPS domain.
- [ ] Verify DNS, TLS, and redirects for alternate hostnames.
- [ ] Check `robots.txt`.
- [ ] Verify canonical tags.
- [ ] Verify the generated Open Graph image.
- [ ] Validate the sitemap against the final domain.
- [ ] Ensure only appropriate canonical, indexable routes appear in the sitemap.
- [ ] Ensure private/admin pages are not exposed through public indexing.

#### Forms and Admin

- [ ] Submit a test inquiry.
- [ ] Submit a test review and verify its moderation status