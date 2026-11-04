import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('public inquiry and discovery forms use the shared form-field styles', () => {
  const forms = read('src/components/forms/public-forms.tsx');
  assert.match(forms, /export function InquiryForm\(\)/);
  assert.match(forms, /export function DiscoveryForm\(\)/);
  assert.match(forms, /className=\{'form-field '\+className\}/);
  assert.match(forms, /<input name="name"/);
  assert.match(forms, /<textarea name="projectDescription"/);
  assert.match(forms, /<input name="fullName"/);
  assert.match(forms, /<textarea name="projectDescription"/);

  const styles = read('src/styles/globals.css');
  assert.match(styles, /\.form-field input,\.form-field textarea,\.form-field select/);
});
test('browser QA overrides tokens on actual root and clears each test override', () => {
  const source = read('scripts/browser-component-qa.mjs');
  assert.match(source, /root\.style\.setProperty\(token, sentinel, 'important'\)/);
  assert.match(source, /document\.documentElement\.style\.removeProperty\(token\)/);
});
