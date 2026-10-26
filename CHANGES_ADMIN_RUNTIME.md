# Admin runtime and database diagnostics — 26 October 2026

Includes the earlier billing draft visibility fix.

Changes:
- Admin server pages that check authentication or redirect now explicitly opt out of instant-navigation validation with instant=false, following the installed Next.js 16.4.2 documentation. These routes intentionally wait for server data.
- isDiscoveryAdmin awaits connection() before reading cookies and evaluating session expiry. Expired and invalid signatures remain rejected; no authentication result is cached.
- Operations and public reviews inspect Supabase response content type before JSON parsing. Server diagnostics include the resource, HTTP status, content type, redirect flag and a safe database error code where available. Response bodies, credentials and private records are not logged by the new helper.
- Operations validation failures identify field paths. The UI no longer assumes every failure means missing migrations.
- Five new regression tests cover response handling and session request ordering, alongside the seven existing billing tests.

Important: this does NOT establish or repair the user's actual Supabase endpoint/proxy configuration. The observed HTML response remains an external configuration investigation. No live database or browser verification was performed. No migrations or credentials were changed.

Run npm ci, npm test, npm run build. Start the application with your own .env.local. If the error persists, share only the new diagnostic line (resource/status/content type) or the SUPABASE_URL value, never keys. Verify that SUPABASE_URL is your project's API base URL, not a dashboard or website URL and not a URL ending in /rest/v1.

Validation: 12 regression tests passed; ESLint passed. Production build passed, including TypeScript and 67/67 generated entries. Browser development navigation still needs verification on the user's running environment.
