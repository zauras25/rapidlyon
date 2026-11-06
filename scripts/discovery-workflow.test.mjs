import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('clarification workflow storage is private and server-role only', () => {
  const migration = read('supabase/migrations/20261105000100_discovery_clarification_workflow.sql');
  for (const table of [
    'discovery_clarification_invitations',
    'discovery_clarification_questions',
    'discovery_service_reviews',
    'discovery_research_sessions',
    'discovery_workflow_events',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /token_hash text unique/);
  assert.match(migration, /grant execute on function public\.submit_discovery_clarification_response[\s\S]*?to service_role/);
});

test('scope readiness is enforced by SQL for open questions, sessions, and service reviews', () => {
  const migration = read('supabase/migrations/20261105000100_discovery_clarification_workflow.sql');
  assert.match(migration, /question\.status in \('draft','sent'\)/);
  assert.match(migration, /session\.status <> 'completed'/);
  assert.match(migration, /review\.result is distinct from 'suitable'/);
  assert.match(migration, /client_service_choice_required/);
  assert.match(migration, /client_project_id is null or scope_readiness_status = 'ready'/);
});

test('public client actions require a same-origin request and a scoped Discovery token', () => {
  const route = read('src/app/api/discovery/respond/route.ts');
  assert.match(route, /verifyLeadToken\(token,'qd'\)/);
  assert.match(route, /hashDiscoveryWorkflowToken\(token\)/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /public-discovery-response/);
  assert.doesNotMatch(route, /close_reason:question\.close_reason/);
  assert.doesNotMatch(route, /findings:sessions\[0\]\.findings/);
});

test('admin workflow uses authenticated APIs and keeps scope readiness visible', () => {
  const route = read('src/app/api/admin/discovery/[id]/workflow/route.ts');
  const component = read('src/components/console/discovery-clarification-workflow.tsx');
  assert.match(route, /await isDiscoveryAdmin\(\)/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /save_discovery_service_review/);
  assert.match(route, /set_discovery_scope_readiness/);
  assert.match(component, /\['questions','Client questions',openCount\]/);
  assert.match(component, /\['session','Session',session\?1:0\]/);
  assert.match(component, /Session workspace pages/);
  assert.match(component, /Service suitability/);
  assert.match(component, /Scope readiness/);
});
