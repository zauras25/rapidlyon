/* RapidlyOn Phase 7: read-only authenticated browser QA. Never commits sessions or performs write actions. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';

const base = (process.env.QA_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const out = path.resolve('qa-results', `live-admin-${stamp}`);
const routes = [
  ['Overview','/admin'], ['Inquiries','/admin/inquiries'], ['Discovery','/admin/discovery'],
  ['Operations','/admin/operations'], ['Clients','/admin/clients'], ['Billing','/admin/billing'],
  ['Projects','/admin/projects'], ['Files','/admin/files'], ['Reviews','/admin/reviews'],
  ['Notifications','/admin/notifications'], ['Support','/admin/support'],
  ['Audit','/admin/audit'], ['Search','/admin/search'], ['Settings','/admin/settings'],
];
const widths = [{name:'desktop',width:1440,height:900},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}];
const results = [];
await mkdir(out,{recursive:true});
const report = async () => {
  const counts = Object.groupBy(results,r=>r.status);
  await writeFile(path.join(out,'results.json'), JSON.stringify({base,counts:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v.length])),results},null,2));
  const cols=['screen','viewport','status','title','overflow','consoleErrors','failedApi','note'];
  const esc = v => `"${String(v??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')}"`;
  await writeFile(path.join(out,'summary.csv'),[cols.join(','),...results.map(x=>cols.map(c=>esc(x[c])).join(','))].join('\n'));
};
let browser;
try {
  const response = await fetch(`${base}/admin`,{signal:AbortSignal.timeout(10000)}).catch(()=>null);
  if (!response) throw new Error(`Local server is unavailable at ${base}; start npm run dev first.`);
  browser = await chromium.launch({headless:false});
  const ctx = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page = await ctx.newPage();
  await page.goto(`${base}/admin`,{waitUntil:'domcontentloaded',timeout:30000});
  console.log('Browser opened at /admin. Log in manually (password + MFA). No credentials will be saved.');
  const rl = createInterface({input:process.stdin,output:process.stdout});
  await rl.question('After the Admin dashboard is visible, press Enter here to begin READ-ONLY checks: ');
  rl.close();
  const bodyText = await page.locator('body').innerText().catch(()=> '');
  if (/password is incorrect|admin mfa is not configured/i.test(bodyText)) throw new Error('Admin login is not complete. No pages scanned.');
  for (const route of routes) {
    for (const vp of widths) {
      const errors=[]; const apis=[];
      const onError = e => errors.push(String(e.message||e).slice(0,200));
      const onConsole = m => {if(m.type()==='error') errors.push(m.text().slice(0,200));};
      const onResponse = r => {try {const u = new URL(r.url());if(u.origin===new URL(base).origin && u.pathname.startsWith('/api/') && r.status()>=400) apis.push(`${r.status()} ${u.pathname}`);}catch{}};
      page.on('pageerror',onError); page.on('console',onConsole); page.on('response',onResponse);
      let status='PASS';let note='';let title='';let overflow='';
      try {
        await page.setViewportSize({width:vp.width,height:vp.height});
        const resp = await page.goto(`${base}${route[1]}`,{waitUntil:'domcontentloaded',timeout:30000});
        await page.waitForTimeout(850);
        title=await page.title();
        const metrics = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,heading:document.querySelector('h1,h2')?.textContent?.trim().slice(0,90)||''}));
        overflow = Math.max(0,metrics.scroll-metrics.client);
        if(resp?.status()>=400){status='FAIL';note=`HTTP ${resp.status()}`;}
        if(overflow>8){status='FAIL';note=[note,`Horizontal overflow ${overflow}px`].filter(Boolean).join('; ');}
        const text = await page.locator('body').innerText().catch(()=> '');
        if(/sign in|admin password|enter.*password/i.test(text.slice(0,1200)) && !/sign out|log out/i.test(text.slice(0,1200))){status='BLOCKED';note='Authentication may be required; verify screenshot';}
        const img = path.join(out,`${route[0].toLowerCase()}-${vp.name}.png`);
        await page.screenshot({path:img,fullPage:false,animations:'disabled'});
        if(errors.length||apis.length){if(status==='PASS')status='REVIEW';}
      }catch(e){status='FAIL';note=String(e.message||e).slice(0,220);}
      finally{page.off('pageerror',onError);page.off('console',onConsole);page.off('response',onResponse);}
      results.push({screen:route[0],viewport:vp.name,status,title,overflow,consoleErrors:errors.length,failedApi:[...new Set(apis)].join(' | '),note});
      console.log(`${status.padEnd(7)} ${route[0].padEnd(15)} ${vp.name} ${note}`);
      await report();
    }
  }
  console.log(`\nFinished read-only browser scan. Local report: ${out}`);
  console.log('Screenshots may include real client data; DO NOT upload them without redaction.');
} catch(e) {
  console.error(`QA stopped: ${e.message||e}`);
  process.exitCode=1;
} finally { await report(); if(browser) await browser.close(); }
