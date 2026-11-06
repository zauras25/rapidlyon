/** Browser-based visual/token verification. Run against your locally running RapidlyOn instance. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = (process.env.QA_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const out = process.env.QA_OUTPUT || 'qa-output/design-system';
const routes = ['/', '/services', '/pricing', '/contact', '/process', '/work', '/client/login', '/admin/discovery/login'];
const viewports = [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}];
const modes = ['light','dark'];
const report = {base,generatedAt:new Date().toISOString(),pages:[],tokenChecks:[],errors:[],notes:['Protected admin/client pages require an authenticated session; this script does not bypass login.','Static and computed-style checks do not establish that every component uses tokens.']};
await mkdir(out,{recursive:true});
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const viewport of viewports){
    for(const mode of modes){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},colorScheme:mode,reducedMotion:'reduce'});
      await context.addInitScript(theme=>{try{localStorage.setItem('rapidlyon-theme',theme)}catch{};document.documentElement.dataset.theme=theme},mode);
      const page=await context.newPage();
      for(const route of routes){
        const entry={route,viewport:viewport.name,mode};
        const exceptions=[];
        const onError=err=>exceptions.push(String(err.message||err));
        page.on('pageerror',onError);
        try{
          const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000});
          await page.waitForTimeout(350);
          entry.status=response?.status()??null;
          entry.title=await page.title();
          entry.theme=await page.locator('html').getAttribute('data-theme');
          entry.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
          entry.primaryCount=await page.locator('.button-primary,.phase6-primary,.rp-hero-cta').count();
          const slug=route==='/'?'home':route.slice(1).replaceAll('/','-');
          entry.screenshot=join(out,`${slug}-${viewport.name}-${mode}.png`);
          await page.screenshot({path:entry.screenshot,fullPage:true,animations:'disabled'});
        }catch(e){entry.error=String(e.message||e);report.errors.push(`${route} ${viewport.name} ${mode}: ${entry.error}`)}
        entry.pageErrors=[...exceptions];
        page.off('pageerror',onError);
        report.pages.push(entry);
      }
      await context.close();
    }
  }
  // Each route gets an isolated context. Compare to ONE known test color, not merely "changed".
  const expected = 'rgb(160, 20, 170)';
  for (const route of ['/', '/client/forgot-password', '/admin/discovery/login']) {
    const context = await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});
    await context.addInitScript(() => {
      try { localStorage.setItem('rapidlyon-theme','light'); } catch {}
      document.documentElement.dataset.theme='light';
    });
    const page = await context.newPage();
    const entry = {route};
    try {
      await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForTimeout(250);
      // Freeze transitions before reading computed values. Otherwise an in-flight
      // background-color transition can be mistaken for a missing token binding.
      await page.addStyleTag({content:'*,*::before,*::after{transition-property:none!important;transition-duration:0s!important;transition-delay:0s!important;animation:none!important;}'});
      const inspect = () => [...document.querySelectorAll('.button-primary,.phase6-primary,.rp-hero-cta')].slice(0,10).map(el => {
        const style = getComputedStyle(el);
        const root = getComputedStyle(document.documentElement);
        return {
          selector: typeof el.className === 'string' ? el.className : String(el.className),
          background: style.backgroundColor,
          componentToken: style.getPropertyValue('--component-button-primary-bg').trim(),
          semanticToken: style.getPropertyValue('--semantic-brand-primary').trim(),
          rootComponentToken: root.getPropertyValue('--component-button-primary-bg').trim(),
          rootSemanticToken: root.getPropertyValue('--semantic-brand-primary').trim(),
          transitionDuration: style.transitionDuration
        };
      });
      entry.before = await page.evaluate(inspect);
      entry.consumers = entry.before.length;
      await page.addStyleTag({content:':root,html[data-theme="light"],html[data-theme="dark"]{--component-button-primary-bg:rgb(160, 20, 170) !important;--semantic-brand-primary:rgb(160, 20, 170) !important;}'});
      // Flush style/layout and wait for the next paint even in reduced-motion contexts.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const afterDetails = await page.evaluate(inspect);
      entry.after = afterDetails.map(el => el.background);
      entry.afterDetails = afterDetails;
      entry.changed = entry.after.map((color,i)=>color===expected && entry.before[i]?.background!==color);
      entry.allChanged = entry.changed.length ? entry.changed.every(Boolean) : null;
      entry.failures = afterDetails.map((el,i) => ({index:i+1,...el,expected})).filter((el,i)=>!entry.changed[i]);
      if(entry.allChanged===false)report.errors.push(`${route}: primary consumer did not resolve to ${expected}`);
    } catch(e) {entry.error=String(e.message||e);report.errors.push(`${route}: ${entry.error}`)}
    report.tokenChecks.push(entry);
    await context.close();
  }
}catch(e){report.errors.push(`Browser startup: ${String(e.message||e)}`)}
finally{if(browser)await browser.close();await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));}
console.log(`Screenshots: ${report.pages.filter(x=>x.screenshot).length}. Token routes tested: ${report.tokenChecks.length}. Issues: ${report.errors.length}.`);
console.log(`Detailed results: ${join(out,'results.json')}`);
if(report.errors.length)process.exitCode=1;
