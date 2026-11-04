import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const mustExist = [
  'src/design-system/tokens.css', 'src/styles/globals.css','public/brand/rapidlyon-mark.svg',
  'src/app/page.tsx','src/app/not-found.tsx','src/components/site/chrome.tsx',
  'src/components/site/public-pages.tsx','src/components/console/admin-console.tsx',
  'src/components/console/client-console.tsx','src/components/forms/public-forms.tsx',
  'src/app/contact/page.tsx','src/app/discovery/page.tsx',
  'src/app/admin/[[...segments]]/page.tsx','src/app/client/[[...segments]]/page.tsx',
  'src/app/api/discovery/route.ts','src/app/api/inquiries/route.ts','src/app/api/admin/session/route.ts',
  'src/app/api/client/workspace/route.ts',
];
for (const f of mustExist) assert.ok(existsSync(f),`Missing ${f}`);
const tokens=readFileSync('src/design-system/tokens.css','utf8');
const css=readFileSync('src/styles/globals.css','utf8');
for (const key of ['--font-display','--font-body','--text-h1','--text-h2','--text-h3','--text-h4','--text-h5','--text-h6','--text-body','--text-lead','--space-1','--space-24','--button-primary-bg']) assert.ok(tokens.includes(key),`Missing token ${key}`);
assert.ok(css.includes('prefers-reduced-motion'),'Missing reduced motion');
assert.ok(css.includes('max-width:580px'),'Missing mobile breakpoint');
const discovery=readFileSync('src/components/forms/public-forms.tsx','utf8');
assert.ok(discovery.includes("fetch('/api/discovery'"),'Discovery not connected to API');
assert.ok(discovery.includes("fetch('/api/inquiries'"),'Inquiry not connected to API');
const admin=readFileSync('src/components/console/admin-console.tsx','utf8');
assert.ok(admin.includes("'/api/admin/session'"),'Admin login not connected');
const client=readFileSync('src/components/console/client-console.tsx','utf8');
assert.ok(client.includes('getSupabaseClient'),'Client auth not connected');
console.log(`PASS: ${mustExist.length} essential files, typography/spacing tokens, motion, API references`);
