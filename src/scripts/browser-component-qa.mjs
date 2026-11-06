/** Runtime design-token smoke test. Does not authenticate or modify application data. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = (process.env.QA_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const output = process.env.QA_OUTPUT || 'qa-output/component-tokens';
const routes = ['/', '/services', '/pricing', '/contact', '/client/login', '/client/forgot-password', '/admin/discovery/login'];
const modes = ['light', 'dark'];
const roles = [
  { name: 'page background', token: '--semantic-bg-page', selector: 'body', property: 'backgroundColor', sentinel: 'rgb(113, 42, 163)' },
  { name: 'card background', token: '--component-card-bg', selector: '.ds-card, .rp-card, .service-card, [class~="ds-card"]', property: 'backgroundColor', sentinel: 'rgb(129, 53, 177)' },
  { name: 'input background', token: '--component-input-bg', selector: '.ds-input, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea', property: 'backgroundColor', sentinel: 'rgb(117, 65, 159)' },
  { name: 'navigation background', token: '--component-nav-bg', selector: '.rp-nav, .ds-nav, .admin-topbar, .studio-topbar', property: 'backgroundColor', sentinel: 'rgb(151, 73, 139)' },
];
const report = { base, generatedAt: new Date().toISOString(), checks: [], errors: [], notes: [
  'This is an unauthenticated representative-selector smoke test, not exhaustive component coverage.',
  'Skipped checks mean the selector was absent on that route; they are not passes.',
  'A failure can indicate a legitimate component variant or a token-bypass and requires review.'
] };
await mkdir(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const mode of modes) for (const route of routes) {
    const context = await browser.newContext({ colorScheme: mode, reducedMotion: 'reduce', viewport: {width: 1440, height: 900} });
    await context.addInitScript(theme => { try { localStorage.setItem('rapidlyon-theme', theme); } catch {} document.documentElement.dataset.theme = theme; }, mode);
    const page = await context.newPage();
    try {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'no response'}`);
      await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
      for (const role of roles) {
        const found = await page.locator(role.selector).count();
        if (!found) { report.checks.push({route,mode,role:role.name,status:'skipped',reason:'selector absent'}); continue; }
        const before = await page.locator(role.selector).evaluateAll((els, p) => els.slice(0,10).map(el => getComputedStyle(el)[p]), role.property);
        await page.evaluate(({ token, sentinel }) => {
          const root = document.documentElement;
          root.style.setProperty(token, sentinel, 'important');
        }, {token:role.token, sentinel:role.sentinel});
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const after = await page.locator(role.selector).evaluateAll((els, p) => els.slice(0,10).map(el => getComputedStyle(el)[p]), role.property);
        const changed = after.map((color,i) => color === role.sentinel && before[i] !== color);
        const passed = changed.every(Boolean);
        report.checks.push({route,mode,role:role.name,status: passed ? 'passed' : 'review',token:role.token,selector:role.selector,before,after,changed});
        if (!passed) report.errors.push(`${route} ${mode}: ${role.name} did not uniformly inherit ${role.token}`);
        // Remove only the test's inline token override; retain application styles.
        await page.evaluate(token => document.documentElement.style.removeProperty(token), role.token);
      }
    } catch (error) { report.errors.push(`${route} ${mode}: ${String(error.message || error)}`); }
    finally { await context.close(); }
  }
} catch (error) { report.errors.push(`Browser startup: ${String(error.message || error)}`); }
finally {
  if (browser) await browser.close();
  await writeFile(join(output,'results.json'),JSON.stringify(report,null,2));
}
const counts = Object.fromEntries(['passed','review','skipped'].map(s => [s,report.checks.filter(x=>x.status===s).length]));
console.log(`Component-token QA: ${JSON.stringify(counts)}; Issues: ${report.errors.length}. Results: ${join(output,'results.json')}`);
if(report.errors.length) process.exitCode = 1;
