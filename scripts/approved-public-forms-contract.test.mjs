import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const form = read('../src/components/forms/public-forms.tsx');
const page = read('../src/app/discovery/page.tsx');
const shared = read('../src/components/site/public-pages.tsx');
const schema = read('../src/lib/discovery.ts');
const inquiryAPI = read('../src/app/api/inquiries/route.ts');
const discoveryAPI = read('../src/app/api/discovery/route.ts');

test('public discovery route uses the approved form rather than GuidedDiscovery', () => {
  assert.match(page, /DiscoveryPage/);
  assert.doesNotMatch(page, /GuidedDiscovery/);
  assert.match(shared, /<DiscoveryForm\s*\/>/);
});
test('two separate public forms, with the approved headline copy', () => {
  assert.match(form, /export function InquiryForm/);
  assert.match(form, /export function DiscoveryForm/);
  for (const snippet of ['Every great project starts with a conversation.', 'Let&apos;s understand your project.', 'Your profile', 'Your project', 'Services', 'Planning', 'Review']) assert.ok(form.includes(snippet), snippet);
});
test('persona includes optional age and gender and required working context', () => {
  for (const field of ['Age range (optional)', 'Gender (optional)', 'Your role in this project', 'How familiar are you with digital projects?', 'How would you prefer to collaborate?', 'When are you usually available?']) assert.ok(form.includes(field), field);
});
test('all three service branches and multi-service support exist', () => {
  for (const field of ['Product Design', 'Development', 'SEO', 'Multiple services selected', 'What is complete, and what remains?', 'What should the product do?', 'What\u0026apos;s your main SEO objective or problem?']) assert.ok(form.includes(field), field);
});
test('Supabase submission endpoints and approved answer payload remain connected', () => {
  assert.match(form, /fetch\('\/api\/inquiries'/);
  assert.match(form, /fetch\('\/api\/discovery'/);
  assert.match(form, /approved\.selectedServices/);
  assert.match(form, /selectedPackageId/);
  assert.match(form, /invitationToken/);
  assert.match(schema, /answers: answersSchema/);
  assert.match(inquiryAPI, /rest\/v1\/inquiries/);
  assert.match(discoveryAPI, /rest\/v1\/discovery_submissions/);
});
test('submitted answers exclude non-selected service sections and conditionally hidden persona data', () => {
  assert.match(form, /selectedServices\.includes\('design'\)\?designKeys/);
  assert.match(form, /selectedServices\.includes\('dev'\)\?devKeys/);
  assert.match(form, /selectedServices\.includes\('seo'\)\?seoKeys/);
  assert.match(form, /values\.gender === 'Self-describe'/);
  assert.match(form, /values\.budgetStatus === 'defined'/);
});
