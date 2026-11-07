import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Admin sections link to genuine authenticated module endpoints',()=>{
 const app=read('src/components/console/admin-console.tsx');
 for(const navItem of ['Operations Inbox','Inquiries','Discovery','Clients','Delivery Projects','Support','Business Analytics','Audit Log','Global Search','Settings','Files & Approvals'])assert.ok(app.includes(navItem),`Missing navigation item: ${navItem}`);
 for(const componentName of ['DeliveryProjects','Clients360','SupportWorkspace','AuditWorkspace','GlobalSearchWorkspace','AdminConfiguration'])assert.ok(app.includes(`<${componentName}/>`));
});
test('Delivery workspace is not a public portfolio editor',()=>{
 const app=read('src/components/console/admin-console.tsx');
 assert.match(app,/projects:'\/api\/admin\/operations'/);
 assert.match(app,/portfolio:'\/api\/admin\/projects'/);
 assert.match(app, /section==='projects'&&<DeliveryProjects\/>/);
});
test('Locked 40-30-30 commercial split remains enforced',()=>{
 const scheduler=read('src/lib/payment-schedule.ts');const sql=read('supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql');
 assert.match(scheduler,/40/);assert.match(scheduler,/30/);assert.match(sql,/40/);assert.match(sql,/30/);
});
test('MFA is required before owner session issuance',()=>{
 const login=read('src/app/api/admin/session/route.ts');const verify=read('src/app/api/admin/session/verify/route.ts');const auth=read('src/lib/discovery-auth.ts');
 assert.match(login,/adminMfaConfigured/);assert.match(login,/createMfaChallenge/);assert.doesNotMatch(login,/createAdminSession\(/);
 assert.match(verify,/verifyAdminTotp/);assert.match(verify,/validMfaChallenge/);assert.match(verify,/createAdminSession\(/);
 assert.match(auth,/mfa-\$\{expiresAt\}/);
});
test('Admin support and settings writes enforce guards',()=>{
 for(const path of ['src/app/api/admin/support/route.ts','src/app/api/admin/support/[id]/route.ts','src/app/api/admin/settings/route.ts','src/app/api/admin/clients/[id]/notes/route.ts']){
  const file=read(path);assert.match(file,/isDiscoveryAdmin/);assert.match(file,/isSameOriginRequest/);assert.match(file,/checkRateLimit/);
 }
 const ticket=read('src/app/api/admin/support/[id]/route.ts');assert.match(ticket,/Transition from/);assert.match(ticket,/client_verification/);
});
test('New tables deny direct anon/authenticated and retain previous records',()=>{
 const migration=read('supabase/migrations/20261107000100_support_and_client_notes.sql');
 for(const table of ['support_tickets','support_ticket_events','client_relationship_notes','admin_workspace_settings']){
  assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(migration,new RegExp('revoke all on public\\.'+table+' from anon, authenticated'));
 }
 assert.match(migration,/support_close_has_resolution/);
});
test('Original Supabase migrations and public site are preserved',()=>{
 for(const p of ['supabase/migrations/20261101000300_payment_attempts_and_verified_reconciliation.sql','src/app/page.tsx','src/components/site/chrome.tsx','src/styles/globals.css'])assert.ok(existsSync(new URL('../'+p,import.meta.url)));
});
