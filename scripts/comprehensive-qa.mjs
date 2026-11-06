/** RapidlyOn non-destructive browser QA. Run from project root against local server. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT = resolve(process.env.QA_OUTPUT_DIR || 'qa-artifacts/comprehensive');
const ROUTES = [
  '/', '/about', '/services', '/pricing', '/process', '/work', '/contact',
  '/discovery', '/faq', '/insights', '/privacy', '/terms',
  '/client/login', '/admin/discovery/login'
];
const VIEWS = [{name:'mobile',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1440,height:900}];
const MODES = ['light','dark'];
const audit = {startedAt:new Date().toISOString(),base:BASE,readOnly:true,results:[],journeys:[],limitations:[
  'Screenshots are evidence for human visual review, not pixel-perfect Figma comparisons.',
  'Authenticated admin/client business flows require dedicated test accounts and a disposable test database.',
  'No form submissions, payments, emails, deletions, or other data-changing actions are performed.',
  'Automated checks cannot fully certify accessibility, visual polish or production readiness.'
]};
await mkdir(OUT,{recursive:true});
const esc = x => String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const safe = x => x.replace(/[^a-z0-9-]/gi,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'home';
const add = (r,severity,code,detail) => r.findings.push({severity,code,detail});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try {
 for(const view of VIEWS) for(const mode of MODES) {
   const context = await browser.newContext({viewport:{width:view.width,height:view.height},colorScheme:mode,reducedMotion:'reduce',deviceScaleFactor:1});
   await context.addInitScript(theme=>{
     try {localStorage.setItem('rapidlyon-theme',theme);} catch {}
     const set=()=>document.documentElement.setAttribute('data-theme',theme);
     if(document.documentElement) set(); else document.addEventListener('DOMContentLoaded',set,{once:true});
   },mode);
   for(const route of ROUTES) {
     const page=await context.newPage();
     const r={route,viewport:view.name,theme:mode,status:null,finalPath:null,screenshot:null,metrics:{},findings:[]};
     const jsErrors=[]; const badResponses=[];
     page.on('pageerror',e=>jsErrors.push(String(e?.message||e).slice(0,240)));
     page.on('response',resp=>{if(resp.status()>=500 && resp.url().startsWith(BASE))badResponses.push(`${resp.status()} ${resp.url().split('?')[0]}`)});
     try {
       const response=await page.goto(new URL(route,BASE).href,{waitUntil:'domcontentloaded',timeout:30000});
       r.status=response?.status()??null;
       r.finalPath=new URL(page.url()).pathname;
       await page.evaluate(()=>document.fonts.ready);
       await page.waitForTimeout(300);
       const protectedRoute=/^\/(admin|client)/.test(route);
       const redirectedToLogin=protectedRoute && r.finalPath!==route && /login|sign-in/.test(r.finalPath);
       if(redirectedToLogin) add(r,'info','AUTH_REDIRECT','Protected route redirected to login; authenticated content not tested.');
       if(!r.status || r.status>=400) add(r,'error','HTTP',`HTTP ${r.status??'no response'}`);
       if(r.finalPath!==route && !redirectedToLogin) add(r,'warning','REDIRECT',`Navigated to ${r.finalPath}`);
       r.metrics=await page.evaluate(()=>{
         const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
         const controls=[...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea')].filter(visible);
         const unlabeled=controls.filter(e=>{
           if(e.matches('a,button')) return !((e.innerText||'').trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || e.querySelector('img[alt]:not([alt=""])'));
           return !(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length||e.getAttribute('title'));
         });
         const brokenImages=[...document.images].filter(e=>visible(e)&&e.complete&&e.naturalWidth===0).map(e=>e.currentSrc.slice(0,140));
         const internalLinks=[...document.querySelectorAll('a[href]')].filter(visible).map(e=>({href:e.getAttribute('href'),label:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,80)}));
         const requiredInputs=[...document.querySelectorAll('input[required],textarea[required],select[required]')].map(e=>({name:e.name||e.id,type:e.type||e.tagName}));
         return {title:document.title,theme:document.documentElement.getAttribute('data-theme'),h1:document.querySelectorAll('main h1').length,main:document.querySelectorAll('main').length,viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,unlabeled:unlabeled.length,unlabeledExamples:unlabeled.slice(0,5).map(e=>e.outerHTML.slice(0,160)),missingAlt:document.querySelectorAll('img:not([alt])').length,brokenImages,requiredInputs,internalLinks:internalLinks.filter(x=>x.href?.startsWith('/') && !x.href.startsWith('//')).slice(0,40),buttons:controls.filter(e=>e.matches('button')).length,visibleControlCount:controls.length,smallTargets:controls.filter(e=>{const b=e.getBoundingClientRect();return b.width<24||b.height<24}).length};
       });
       const m=r.metrics;
       if(m.documentWidth>m.viewportWidth+2) add(r,'error','OVERFLOW',`${m.documentWidth-m.viewportWidth}px horizontal overflow`);
       if(!protectedRoute && m.h1!==1) add(r,'warning','HEADING',`Expected 1 main H1; found ${m.h1}`);
       if(!protectedRoute && m.main!==1) add(r,'warning','LANDMARK',`Expected 1 main landmark; found ${m.main}`);
       if(m.unlabeled) add(r,'error','LABELS',`${m.unlabeled} visible interactive controls with no accessible label`);
       if(m.missingAlt) add(r,'warning','ALT',`${m.missingAlt} images missing alt attribute`);
       if(m.brokenImages.length) add(r,'error','IMAGES',`${m.brokenImages.length} broken visible images`);
       if(m.smallTargets) add(r,'info','TARGET_SIZE',`${m.smallTargets} interactive controls under 24px on one axis; review`);
       if(m.theme!==mode) add(r,'warning','THEME',`Expected ${mode}, found ${m.theme??'unset'} (check app theme implementation)`);
       await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
       const name=`${view.name}-${mode}-${safe(route)}.png`;
       await page.screenshot({path:join(OUT,name),fullPage:true,animations:'disabled',timeout:30000});
       r.screenshot=name;
     } catch(e) {add(r,'error','TEST_EXCEPTION',String(e?.message||e).slice(0,300));}
     if(jsErrors.length)add(r,'error','JS_ERROR',jsErrors.slice(0,4).join(' | '));
     if(badResponses.length)add(r,'error','SERVER_ERROR',badResponses.slice(0,4).join(' | '));
     audit.results.push(r);
     console.log(`${view.name.padEnd(7)} ${mode.padEnd(5)} ${route.padEnd(24)} ${r.findings.some(f=>f.severity==='error')?'FAIL':r.findings.length?'REVIEW':'PASS'}`);
     await page.close();
   }
   await context.close();
 }
 // Non-mutating navigation behavior: validate representative same-origin link click.
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await ctx.newPage();
 try {
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   const candidate=page.locator('a[href="/services"]').first();
   if(await candidate.count() && await candidate.isVisible()) {
     await candidate.click({timeout:10000});
     audit.journeys.push({name:'Home to services navigation',status:new URL(page.url()).pathname==='/services'?'pass':'fail',detail:page.url()});
   }else audit.journeys.push({name:'Home to services navigation',status:'not-tested',detail:'No visible /services link'});
 } catch(e){audit.journeys.push({name:'Home to services navigation',status:'fail',detail:String(e.message).slice(0,200)})}
 await ctx.close();
} finally {await browser.close()}
audit.finishedAt=new Date().toISOString();
const errors=audit.results.flatMap(r=>r.findings.filter(f=>f.severity==='error'));
const warnings=audit.results.flatMap(r=>r.findings.filter(f=>f.severity==='warning'));
audit.summary={screens:audit.results.length,screenshots:audit.results.filter(r=>r.screenshot).length,errors:errors.length,warnings:warnings.length,journeysPassed:audit.journeys.filter(j=>j.status==='pass').length,journeysFailed:audit.journeys.filter(j=>j.status==='fail').length};
await writeFile(join(OUT,'report.json'),JSON.stringify(audit,null,2));
const entries=audit.results.map(r=>`<article><h2>${esc(r.viewport)} / ${esc(r.theme)} / ${esc(r.route)}</h2><p>HTTP ${esc(r.status)} · ${r.findings.length} finding(s)</p><ul>${r.findings.map(f=>`<li class="${esc(f.severity)}"><b>${esc(f.severity.toUpperCase())}: ${esc(f.code)}</b> — ${esc(f.detail)}</li>`).join('')||'<li>Automated checks passed</li>'}</ul>${r.screenshot?`<a href="${esc(r.screenshot)}"><img loading="lazy" src="${esc(r.screenshot)}" alt="Screenshot ${esc(r.route)}"></a>`:''}</article>`).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RapidlyOn Comprehensive QA</title><style>body{margin:24px;font:14px/1.5 system-ui,sans-serif;background:#f5f7f2;color:#1c2c1d}h1{font-size:28px}header{max-width:940px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:18px}article{background:white;border:1px solid #dce3d6;border-radius:12px;padding:16px;min-width:0}h2{font-size:16px;overflow-wrap:anywhere}img{display:block;width:100%;border:1px solid #ddd;border-radius:6px}.error{color:#a12626}.warning{color:#865500}.info{color:#53645b}li{margin:5px 0;overflow-wrap:anywhere}ul{padding-left:22px}p{overflow-wrap:anywhere}</style></head><body><header><h1>RapidlyOn — Comprehensive QA</h1><p>${esc(audit.startedAt)} · ${audit.summary.screens} scenarios · ${audit.summary.errors} errors · ${audit.summary.warnings} warnings</p><p><b>Read-only browser audit.</b> Functional navigation: ${audit.journeys.map(j=>`${esc(j.name)} (${esc(j.status)})`).join(', ')}. Protected workflows and payment tests are not certified.</p><h3>Limitations</h3><ul>${audit.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></header><main>${entries}</main></body></html>`;
await writeFile(join(OUT,'index.html'),html);
console.log(`\nQA SUMMARY ${JSON.stringify(audit.summary)}\nHTML: ${join(OUT,'index.html')}\nJSON: ${join(OUT,'report.json')}`);
if(errors.length||audit.journeys.some(j=>j.status==='fail')) process.exitCode=1;
