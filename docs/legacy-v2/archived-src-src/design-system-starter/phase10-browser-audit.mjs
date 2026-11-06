import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = (process.env.RAPIDLYON_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROOT = path.resolve(process.env.RAPIDLYON_QA_OUT || 'phase10-qa-results');
const profileRoot = path.resolve('.rapidlyon-qa-profiles');
const manualLogin = process.env.RAPIDLYON_QA_LOGIN === '1';
const publicRoutes = ['/', '/about', '/services', '/services/ux-ui-design', '/services/nextjs-development', '/pricing', '/process', '/work', '/contact', '/discovery', '/faq', '/insights', '/privacy', '/terms'];
const clientRoutes = ['/client', '/client/billing', '/client/login', '/client/forgot-password', '/client/invitations/accept', '/client/reset-password'];
const adminRoutes = ['/admin', '/admin/operations', '/admin/inquiries', '/admin/discovery', '/admin/projects', '/admin/projects/development', '/admin/projects/product-design', '/admin/projects/seo', '/admin/clients', '/admin/billing', '/admin/records', '/admin/reviews'];
fs.mkdirSync(ROOT, {recursive:true});
const findings=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const slug = s => s==='/' ? 'home' : s.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'_').replace(/_$/,'');
const viewportSize = device => device==='mobile' ? {width:390,height:844} : {width:1440,height:900};
function csvEscape(s){ return '"'+String(s??'').replaceAll('"','""')+'"'; }

async function checkRoute(page, section, route, device) {
  const issues=[];
  const failedResources=[];
  let loadingState='not-checked';
  let status=null, finalUrl='', title='', overflow=false, screenshot='';
  const onPageError = e => issues.push('Page error: '+String(e.message).slice(0,250));
  const onConsole = e => {if(e.type()==='error') issues.push('Console: '+e.text().slice(0,250));};
  const onResponse = r => { if (r.status() >= 500) { try { const u=new URL(r.url()); failedResources.push(`${r.status()} ${u.origin}${u.pathname}`); } catch { failedResources.push(`HTTP ${r.status()} (unparseable URL)`); } } };
  try {
    // Reuse the SAME tab for all routes. Creating tabs per screenshot can exhaust
    // Chromium resources or cause a persistent browser to exit unexpectedly.
    await page.setViewportSize(viewportSize(device));
    page.on('pageerror',onPageError);
    page.on('console',onConsole);
    page.on('response',onResponse);
    const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:30000});
    status=response?.status()??null;
    // Wait for React client-side fetches; a 200 shell is not a loaded workspace.
    const readinessSelectors = {
      '/client': '[aria-label="Loading client workspace"]',
      '/client/billing': '[aria-label="Loading billing"]',
      '/admin/operations': '.r-os-loading',
    };
    const loadingSelector=readinessSelectors[route];
    if (loadingSelector && (section === 'client' || section === 'admin')) {
      await sleep(1000);
      try {
        await page.locator(loadingSelector).waitFor({state:'hidden',timeout:12000});
        loadingState='ready';
      } catch {
        loadingState='still-loading';
        issues.push(`Content not ready: ${route} still shows loading after 12s`);
      }
    } else {
      await sleep(1000);
    }
    // Give client effects time to dispatch requests and record 5xx resource responses.
    await sleep(350);
    for(const failure of [...new Set(failedResources)]) issues.push('HTTP resource failure: '+failure);

    finalUrl=page.url();
    title=await page.title();
    overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+8);
    const folder=path.join(ROOT,'screenshots',section,device);
    fs.mkdirSync(folder,{recursive:true});
    screenshot=path.join(folder,slug(route)+'.png');
    await page.screenshot({path:screenshot,fullPage:true,animations:'disabled',timeout:30000});
  } catch(e) {
    issues.push('Navigation/capture: '+String(e.message).slice(0,300));
  } finally {
    if(!page.isClosed()) {
      page.off('pageerror',onPageError);
      page.off('console',onConsole);
      page.off('response',onResponse);
    }
  }
  const pathname=(()=>{try{return new URL(finalUrl).pathname}catch{return ''}})();
  // The login page itself is a legitimate route; only a redirect to login
  // from another route means its authenticated view could not be audited.
  const loginRedirect=(section==='admin'||section==='client') &&
    route!==pathname && (pathname.includes('/login') || pathname==='/client/login');
  const severity=status===null||status>=500||issues.some(i=>i.startsWith('Navigation'))?'fail':
    loginRedirect?'auth-required':status>=400||overflow||issues.length?'review':'pass';
  findings.push({section,route,viewport:device,status,finalUrl,title,overflow,loginRedirect,result:severity,loadingState,failedResources:failedResources.join(' | '),issues:issues.join(' | '),screenshot:screenshot?path.relative(ROOT,screenshot):''});
  console.log(`${severity.padEnd(13)} ${section.padEnd(7)} ${device.padEnd(7)} ${String(status).padEnd(4)} ${route}`);
}
async function openContext(section,channel){
  const profile=path.join(profileRoot,section);
  fs.mkdirSync(profile,{recursive:true});
  try {
    return await chromium.launchPersistentContext(profile,{channel,headless:!manualLogin,viewport:{width:1440,height:900},args:['--no-first-run']});
  } catch(e) {
    throw new Error(`Could not open ${channel} QA profile (${profile}). Close only prior QA automation browsers; keep regular Chrome/Edge open. ${e.message}`);
  }
}
async function prepareAuth(page,section){
  if(!manualLogin) return;
  await page.goto(BASE+(section==='client'?'/client/login':'/admin/discovery/login'),{waitUntil:'domcontentloaded',timeout:30000});
  console.log(`\n${section.toUpperCase()} QA browser open. Log in in THIS window, keep it open, then press Enter in PowerShell.\n`);
  process.stdin.resume();
  await new Promise(resolve=>process.stdin.once('data',resolve));
}
async function auditSection(section,channel,routes){
  let ctx;
  try {
    ctx=await openContext(section,channel);
    // Single page persists through login, desktop and mobile checks.
    const page=ctx.pages()[0] || await ctx.newPage();
    if(section!=='public') await prepareAuth(page,section);
    for(const device of ['desktop','mobile']) {
      for(const route of routes) {
        if(page.isClosed()) {
          console.error(`QA tab closed during ${section}; remaining checks recorded as failed.`);
          for(const remaining of routes.slice(routes.indexOf(route))) {
            findings.push({section,route:remaining,viewport:device,status:null,finalUrl:'',title:'',overflow:false,loginRedirect:false,result:'fail',issues:'QA tab closed',screenshot:''});
          }
          return;
        }
        await checkRoute(page,section,route,device);
      }
    }
  } catch(e) {
    console.error(`${section.toUpperCase()} audit setup failed: ${e.message}`);
    findings.push({section,route:'[section setup]',viewport:'none',status:null,finalUrl:'',title:'',overflow:false,loginRedirect:false,result:'fail',issues:String(e.message).slice(0,300),screenshot:''});
  } finally {
    if(ctx) await ctx.close().catch(()=>{});
  }
}
function save(){
  fs.writeFileSync(path.join(ROOT,'browser-results.json'),JSON.stringify({base:BASE,generatedAt:new Date().toISOString(),findings},null,2));
  const cols=['section','route','viewport','status','finalUrl','title','overflow','loginRedirect','result','loadingState','failedResources','issues','screenshot'];
  fs.writeFileSync(path.join(ROOT,'browser-results.csv'),[cols.join(','),...findings.map(f=>cols.map(c=>csvEscape(f[c])).join(','))].join('\n'));
  const count=s=>findings.filter(f=>f.result===s).length;
  fs.writeFileSync(path.join(ROOT,'BROWSER_SUMMARY.md'),`# RapidlyOn Phase 10 browser audit\n\nBase: ${BASE}\nChecks recorded: ${findings.length}\nPass: ${count('pass')}\nReview: ${count('review')}\nFail: ${count('fail')}\nAuth-required: ${count('auth-required')}\n\nLogin redirects are not passing authenticated checks. Inspect screenshots; they may contain private data. Never share .rapidlyon-qa-profiles.\n\n## Findings requiring attention\n`+findings.filter(f=>f.result!=='pass').map(f=>`- ${f.result.toUpperCase()} ${f.section} ${f.route} ${f.viewport}: status ${f.status}; redirect=${f.loginRedirect}; overflow=${f.overflow}; ${f.issues}`).join('\n')+'\n');
  console.log(`\nSaved ${findings.length} checks to ${ROOT}`);
}
async function main(){
  console.log(`Phase 10 read-only browser audit: ${BASE}`);
  await auditSection('public','chrome',publicRoutes);
  await auditSection('client','chrome',clientRoutes);
  await auditSection('admin','msedge',adminRoutes);
}
try { await main(); } finally { save(); }
