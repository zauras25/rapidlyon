RAPIDLYON STUDIO OS — ADMIN OPERATIONS REDESIGN

1. BACK UP your existing project or commit changes to Git.
2. Copy the src folder from this ZIP into your project root, allowing these four files to be overwritten:
   src/app/globals.css
   src/app/studio-os.css (new)
   src/components/admin/admin-operations.tsx
   src/components/ui/site-chrome.tsx
3. From your project root run: npm install (if dependencies are not installed), then npm run dev.
4. Visit http://localhost:3000/admin/operations and sign in as admin.

Uses your existing /api/admin/operations and authentication. No database migrations or environment changes are needed.
The redesigned page is /admin/operations. Existing project-detail pages and other admin pages retain their previous UI.

IMPORTANT: This is a source-code redesign. A complete build was not run in this environment because node_modules was absent from the uploaded archive. Verify with npm run build locally.
