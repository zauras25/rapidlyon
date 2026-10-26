# Rapidlyon authentication repair — 26 October 2026

## What changed
- Browser Supabase client accepts publishable key or legacy anon key and validates the URL.
- Server configuration uses SUPABASE_URL, falling back to NEXT_PUBLIC_SUPABASE_URL. Secret/service role key remains server-only.
- Password recovery UI differentiates rate limits and email provider failures.
- Password reset page handles PKCE code links and auth recovery events more carefully.

## Configuration (never commit secrets)
Set these in `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_OR_SERVICE_ROLE_KEY

Restart `npm run dev` after editing env vars. Never prefix service-role/secret keys with NEXT_PUBLIC_.

## SMTP cannot be repaired in application code or SQL
Supabase Dashboard > Authentication > SMTP Settings: verify SMTP host, port, username, password, verified sender address/domain and rate limits. Check Authentication > Logs after a test recovery request. Add local and production reset redirect URLs to Authentication > URL Configuration > Redirect URLs.

## Client authorization check (read-only SQL)
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'khizqr@gmail.com';
SELECT id, auth_user_id, email, status FROM public.clients WHERE auth_user_id = '0aa99f45-0527-4158-ac43-c434d3b44156'::uuid;

An authenticated user needs a matching active public.clients record to access the client portal. Do not automatically create one for arbitrary signups.

## Verification
1. npm install
2. npm run build
3. Log in with a known password; verify /client and its API routes.
4. Request password reset after SMTP is configured; follow a fresh link in the same browser.
5. Check Supabase Auth logs for exact email delivery failures.

This is a targeted code patch, not a claim that live Supabase SMTP was changed or that authentication is verified in production.
