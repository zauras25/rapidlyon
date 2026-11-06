import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(name, 'utf8');
test('representative form input classes use the component input token consumer', () => {
  for (const name of [
    'src/components/forms/inquiry-form.tsx',
    'src/components/forms/discovery-form.tsx',
    'src/components/forms/conversation-chat.tsx',
    'src/components/admin/discovery-login-form.tsx',
  ]) {
    assert.match(read(name), /ds-input/, name);
  }
  assert.match(read('src/app/globals.css'), /input\.ds-input,textarea\.ds-input,select\.ds-input/);
});
test('browser QA overrides tokens on actual root and clears each test override', () => {
  const source = read('scripts/browser-component-qa.mjs');
  assert.match(source, /root\.style\.setProperty\(token, sentinel, 'important'\)/);
  assert.match(source, /document\.documentElement\.style\.removeProperty\(token\)/);
});
