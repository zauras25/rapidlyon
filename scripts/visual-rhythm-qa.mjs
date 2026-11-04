/* Browser evidence of typography, rhythm, and component geometry.
   Run: npm run qa:rhythm (with the Next production server already started).
   Only public routes are checked; no credentials or private admin data collected. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessVisualMetrics } from './visual-rhythm-rules.mjs';

const BASE = process.env.QA_BASE_URL || 'http://localhost:3000';
const OUTPUT = resolve(process.env.QA_OUTPUT_DIR || 'qa-artifacts/visual-rhythm');
const routes = ['/', '/about', '/services', '/pricing', '/work', '/contact', '/faq', '/discovery', '/client/login'];
const sizes = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];

await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const records = [];
try {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const [index, pathname] of routes.entries()) {
      const url = new URL(pathname, BASE).toString();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
      await page.evaluate(() => document.fonts.ready).catch(() => null);
      const metrics = await page.evaluate(() => {
        const style = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const computed = getComputedStyle(element);
          return { fontSize: computed.fontSize, lineHeight: computed.lineHeight, fontFamily: computed.fontFamily, letterSpacing: computed.letterSpacing, paddingTop: computed.paddingTop, paddingBottom: computed.paddingBottom, borderRadius: computed.borderRadius, height: Math.round(element.getBoundingClientRect().height) };
        };
        const representativeSection = document.querySelector('.ds-section') || document.querySelector('main section') || document.querySelector('section');
        const sectionStyle = representativeSection ? getComputedStyle(representativeSection) : null;
        return {
          title: document.title,
          body: style('body'),
          h1: style('h1'),
          heading: style('.rp-section-title'),
          section: sectionStyle ? {
            paddingTop: sectionStyle.paddingTop,
            paddingBottom: sectionStyle.paddingBottom,
            marginTop: sectionStyle.marginTop,
            marginBottom: sectionStyle.marginBottom,
            sample: representativeSection.className || representativeSection.tagName.toLowerCase(),
          } : null,
          button: style('.rp-unified-button'), card: style('.surface-card'),
          viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      }).catch(() => ({ evaluationError: true }));
      const slug = pathname === '/' ? 'home' : pathname.replaceAll('/', '-').replace(/^-/, '');
      if (response?.ok()) await page.screenshot({ path: `${OUTPUT}/${size.width}-${index.toString().padStart(2,'0')}-${slug}.png`, fullPage: true, animations: 'disabled' });
      records.push({ route: pathname, viewport: size.width, status: response?.status() ?? null, ...metrics });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${OUTPUT}/metrics.json`, JSON.stringify(records, null, 2));
const assessed = records.map((record) => ({ ...record, ...assessVisualMetrics(record) }));
const failures = assessed.filter((record) => record.issues.length);
const notSampled = assessed.filter((record) => record.notes.length);
await writeFile(`${OUTPUT}/assessment.json`, JSON.stringify(assessed.map(({ route, viewport, status, h1, section, issues, notes }) => ({
  route, viewport, status, heading: h1?.fontSize ?? null, sectionTop: section?.paddingTop ?? null, issues, notes,
})), null, 2));
console.table(assessed.map(({ route, viewport, status, h1, section, viewportOverflow, issues, notes }) => ({
  route, viewport, status, heading: h1?.fontSize ?? 'MISSING', sectionTop: section?.paddingTop ?? 'not sampled',
  overflow: viewportOverflow, issues: issues.length ? issues.join('; ') : '—', notes: notes.length ? 'check sections' : '—',
})));
console.log(`Wrote ${records.length} route/viewport measurements; ${failures.length} failed visual guardrails; ${notSampled.length} have unmeasured section rhythm. Results: ${OUTPUT}`);
if (failures.length) process.exitCode = 1;
