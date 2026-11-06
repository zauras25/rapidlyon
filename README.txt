RapidlyOn Admin Discovery UI repair

Changes:
1. Original client answers displayed in readable sections with human labels, without empty technical fields.
2. Custom questions shown as responsive full-width editable textareas, with clear per-question Remove controls.
3. Email send failure requires runtime provider configuration; no credentials are in this package.

Install: make a Git commit or backup first; overlay the src/ folder into your RapidlyOn project root.
Run: npx tsc --noEmit; npm run lint; npm run build

Email: configure RESEND_API_KEY, DISCOVERY_NOTIFICATION_FROM, NEXT_PUBLIC_SITE_URL in .env.local (local development) or deployment environment. The sender domain must be verified by Resend. Restart Next.js server after updating environment variables. NEVER commit .env.local or paste secrets into chat.

Verification: static source checks passed here; full Next.js build and email delivery not executed.
