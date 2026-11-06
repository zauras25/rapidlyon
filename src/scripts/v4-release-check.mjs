/** No dependencies: source-integrity and V4 UI contracts, not a substitute for build/browser QA. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>fs.existsSync(path.join(root,f));
const mandatory=[
  'src/app/page.tsx','src/app/layout.tsx','src/app/design-system/page.tsx',
  'src/app/admin/[[...segments]]/page.tsx','src/app/client/[[...segments]]/page.tsx',
  'src/components/console/admin-console.tsx','src/components/console/admin-workflows.tsx',
  'src/components/console/portfolio-editor.tsx','src/components/console/client-console.tsx',
  'src/components/console/client-receipt.tsx','src/components/forms/public-forms.tsx',
  'src/styles/globals.css','src/design-system/tokens.css', 'public/brand/rapidlyon-mark.svg',
  'src/app/api/admin/commercial/route.ts','src/app/api/admin/operations/route.ts',
  'src/app/api/admin/discovery/[id]/project/route.ts',
  'src/app/api/client/receipts/[paymentId]/route.ts',
  'src/app/api/discovery/route.ts', 'src/app/api/inquiries/route.ts',
];
for(const file of mandatory)assert.ok(exists(file),`Missing ${file}`);
const tokens=read('src/design-system/tokens.css');
for(const key of ['--font-display','--font-body','--text-h1','--text-h2','--text-h3','--text-h4','--text-h5','--text-h6','--text-body','--text-caption','--space-1','--space-24','--color-brand'])assert.ok(tokens.includes(key),`Missing token: ${key}`);
assert.match(read('src/styles/globals.css'),/prefers-reduced-motion/);
assert.ok(!exists('src/src'),'Legacy duplicate src/src should not be in the release');
const admin=read('src/components/console/admin-console.tsx');
const commercial=read('src/components/console/admin-workflows.tsx');
const client=read('src/components/console/client-console.tsx');
for(const text of ['AdminCommercial','AdminOperationDetail','DiscoveryWorkflow','AdminReviewActions','PortfolioEditor','InquiryReply','purgeInquiry']) assert.ok(admin.includes(text),`Missing admin workflow: ${text}`);
for(const text of ['/api/admin/commercial','/api/admin/discovery/','/api/admin/projects/','/api/admin/reviews/']) assert.ok(commercial.includes(text),`Missing API integration: ${text}`);
for(const text of ['ClientReceipt','paymentAvailable','Payments & receipts']) assert.ok(client.includes(text),`Missing client feature: ${text}`);
assert.match(read('src/components/forms/public-forms.tsx'),/fetch\('\/api\/discovery'/);
assert.match(read('src/components/forms/public-forms.tsx'),/fetch\('\/api\/inquiries'/);
assert.match(read('src/app/api/client/invoices/[invoiceId]/payment/route.ts'),/status: 503/); // Explicitly unconfigured; never fake success.

let tsParsed=0;
let typeScript=null;
// Source integrity checks run before dependency installation, while syntax
// diagnostics are enabled when the project's own TypeScript is installed.
try {
  const require=createRequire(import.meta.url);
  typeScript=require('typescript');
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  console.warn('NOTE — TypeScript parsing skipped: run `npm ci` for full source diagnostics.');
}
function files(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)])}
const srcFiles=files('src').filter(f=>/\.(tsx?|jsx?)$/.test(f));
const diagnostics=[];
const imports=[];
if(typeScript){for(const f of srcFiles){const content=read(f);const sf=typeScript.createSourceFile(f,content,typeScript.ScriptTarget.Latest,true,f.endsWith('tsx')?typeScript.ScriptKind.TSX:typeScript.ScriptKind.TS);tsParsed++;for(const d of sf.parseDiagnostics)diagnostics.push(`${f}: ${typeScript.flattenDiagnosticMessageText(d.messageText,' ')}`);for(const x of content.matchAll(/\bfrom\s*['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g))imports.push([f,x[1]])}}
for(const [from,imp] of imports){const target=imp.startsWith('@/')?path.join(root,'src',imp.slice(2)):path.resolve(root,path.dirname(from),imp);if(!['','.ts','.tsx','.js','.jsx','.json'].some(ext=>fs.existsSync(target+ext))&&!['index.ts','index.tsx','index.js'].some(ext=>fs.existsSync(path.join(target,ext))))diagnostics.push(`${from}: unresolved local import ${imp}`)}
assert.equal(diagnostics.length,0,diagnostics.join('\n'));
console.log(`PASS — V4 source contracts; ${mandatory.length} essential paths; ${tsParsed || 'not available'} TypeScript files syntax checked; ${imports.length} local imports resolved.`);
console.log('NOTE — This does not run Next.js, authenticate users, or verify Supabase/payment services.');
