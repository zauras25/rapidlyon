# RapidlyOn client invitation link + onboarding patch

Applies to source with client-console.tsx and admin/client-projects/[projectId]/invitation/route.ts as in the uploaded RapidlyOn source. Does not alter DB/RLS.

Fixes:
1. Project invitation email uses configured Hostinger SMTP/Resend transport (`src/lib/discovery-email-transport.ts`) instead of separate Resend-only sender.
2. Creates project acceptance URL from validated `NEXT_PUBLIC_SITE_URL` origin; localhost only for local tests.
3. Preserves the invitation token across login, signup and login redirect. Only allowlisted internal invitation URLs are accepted as `next` to prevent open redirects.
4. Shows actionable, non-technical onboarding UI for logged-in users without a linked clients identity, without granting project access.

NOT fixed automatically: database currently has ZERO clients and ZERO projects. Admin must create a real client project and send a legitimate invitation before an authenticated user can have project access. Do not auto-link by email or bypass permissions. Existing pending invitations can be in 'invited' state and cannot be re-issued via this endpoint; inspect statuses before retrying.

Prerequisites: existing `src/lib/discovery-email-transport.ts`, installed nodemailer/@types, valid SMTP_* vars and DISCOVERY_NOTIFICATION_FROM, public NEXT_PUBLIC_SITE_URL (HTTPS for external recipient).

Apply (PowerShell from project root; AFTER backed up Git commit):
  Expand-Archive -LiteralPath "$HOME\Downloads\RapidlyOn-Client-Invitation-Link-Fix.zip" -DestinationPath . -Force
  npm run lint
  npx tsc --noEmit
  npm run build

Security: invitation tokens are secrets, avoid copying URL into chat or logs. Client must sign in with invited verified email. URL delivered to real clients must NOT contain localhost.
