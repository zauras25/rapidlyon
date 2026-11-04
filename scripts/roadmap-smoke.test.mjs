import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const require=createRequire(import.meta.url);
// Resolve the project's installed TypeScript dependency on all platforms.
// Never reference a developer machine's global Node/TypeScript installation.
let ts;
try {
  ts=require('typescript');
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  throw new Error(
    'Local TypeScript is missing. Run `npm ci` successfully in the project root before `npm run test:roadmap`. ' +
    'If npm ci fails with Windows EPERM on next-swc, close running Node/Next.js processes and extract the ZIP into a new empty directory.',
    { cause: error },
  );
}

test('Phase 0: source and migration safety',()=>{
  assert.equal(exists('src/src'),false,'legacy tree must be archived');
  assert.ok(exists('docs/legacy-v2/archived-src-src'));
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).sort();
  assert.ok(migrations.includes('20261029000100_link_inquiry_discovery.sql'));
  assert.ok(migrations.includes('20261029000200_followup_dispatch.sql'));
  assert.ok(migrations.includes('20261029000300_inquiry_idempotency.sql'));
  assert.match(read('supabase/migrations/20261029000100_link_inquiry_discovery.sql'),/CREATE UNIQUE INDEX/);
  assert.match(read('supabase/migrations/20261029000200_followup_dispatch.sql'),/ENABLE ROW LEVEL SECURITY/);
  assert.match(read('supabase/migrations/20261029000300_inquiry_idempotency.sql'),/UNIQUE INDEX/);
  const gitignore = read('.gitignore');
  assert.match(gitignore,/^\.env\*$/m,'environment files must be excluded from source control');
  assert.match(gitignore,/^!\.env\.example$/m,'the safe environment template must remain shareable');
});

test('Phase 2: private lead tokens are scoped, signed and time-limited',()=>{
  const previous=process.env.LEAD_LINK_SECRET;
  try {
    process.env.LEAD_LINK_SECRET='test-only-nonproduction-'+'x'.repeat(64);
    const src=read('src/lib/lead-links.ts');
    const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const mod={exports:{}};
    const mockZ={z:{string:()=>({uuid:()=>({safeParse:id=>({success:/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)})})})}};
    const fakeRequire=x=>x==='zod'?mockZ:x==='server-only'?{}:require(x);
    new Function('require','exports','module','process','Buffer',compiled)(fakeRequire,mod.exports,mod,process,Buffer);
    const {createLeadToken,verifyLeadToken}=mod.exports;
    const id='ac6cfe6f-207b-4b90-849e-20b77c9f0037';
    const invite=createLeadToken('invite',id,1800);
    assert.equal(verifyLeadToken(invite,'invite'),id);
    assert.equal(verifyLeadToken(invite,'qi'),null);
    assert.equal(verifyLeadToken(invite+'broken','invite'),null);
    assert.equal(verifyLeadToken(invite.replace('ac6c','bc6c'),'invite'),null);
    assert.equal(createLeadToken('invite','not-a-uuid',20),null);
    assert.equal(verifyLeadToken(null,'invite'),null);
    assert.equal(verifyLeadToken('invite.'+id+'.0000000001.abc','invite'),null);
    process.env.LEAD_LINK_SECRET='too-short';
    assert.equal(createLeadToken('invite',id,600),null);
  } finally {
    if(previous===undefined)delete process.env.LEAD_LINK_SECRET;
    else process.env.LEAD_LINK_SECRET=previous;
  }
});

test('Phase 2: request flow and admin conversion wired',()=>{
  for(const file of [
    'src/app/api/discovery/invite/route.ts','src/app/api/admin/inquiries/[id]/invite/route.ts',
    'src/app/api/request-status/route.ts','src/app/request-status/page.tsx',
  ])assert.ok(exists(file),file);
  assert.match(read('src/app/api/discovery/route.ts'),/source_inquiry_id: sourceInquiryId/);
  assert.match(read('src/app/api/discovery/route.ts'),/readInvitableInquiry/);
  assert.match(read('src/app/api/inquiries/route.ts'),/on_conflict=submission_key/);
  assert.match(read('src/components/forms/public-forms.tsx'),/submissionKey\.current/);
  assert.match(read('src/app/api/request-status/route.ts'),/select=serial_no,status,created_at/);
});

test('Phases 1, 4 and 5: roadmap implementation wiring',()=>{
  assert.ok(exists('src/data/engagement-options.ts'));
  assert.match(read('src/components/site/public-pages.tsx'),/engagementOptions/);
  assert.match(read('src/components/site/sections.tsx'),/projects=featuredProjects/);
  for(const file of ['src/app/page.tsx','src/app/work/page.tsx','src/app/work/[slug]/page.tsx'])
    assert.match(read(file),/getPublishedWorkProjects/);
  assert.ok(exists('src/app/api/cron/follow-ups/route.ts'));
  assert.match(read('src/app/api/cron/follow-ups/route.ts'),/CRON_SECRET/);
  assert.match(read('src/components/console/admin-console.tsx'),/FollowUpActionCenter/);
  for(const file of ['src/app/insights/[slug]/page.tsx','src/app/services/[slug]/page.tsx','src/app/work/[slug]/page.tsx'])
    assert.match(read(file),/generateMetadata/);
});
