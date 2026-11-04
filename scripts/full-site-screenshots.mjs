/* Captures real site pages, not source mockups. Run against your local Next server.
 * PUBLIC routes work without credentials. Protected routes need a local storage-state file
 * created with qa:save-session; this file contains confidential cookies. Never upload it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const SITE = process.env.QA_BASE_URL || 'http://localhost:3000';
const OUT = resolve(process.env.QA_OUTPUT_DIR || 'qa-artifacts/full-site');
const ROLE = (process.env.QA_ROLE || 'all').toLowerCase();
const VIEWPORTS = [{name:'mobile',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1440,height:900}];
const GROUPS = {
 public: ['/', '/about', '/services', '/services/ux-ui-design', '/services/nextjs-development', '/services/seo-website-optimization', '/pricing', '/process', '/work', '/work/umer-mobile-parts', '/work/trailmix-local-discovery-concept', '/contact', '/discovery', '/faq', '/insights', '/insights/clarity-before-complexity', '/insights/websites-that-convert-without-feeling-salesy', '/insights/designing-for-mvp-clarity', '/privacy', '/terms'],
 client: ['/client', '/client/login', '/client/forgot-password', '/client/reset-password', '/client/billing', '/client/invitations/accept'],
 admin: ['/admin', '/admin/discovery/login', '/admin/operations', '/admin/inquiries', '/admin/discovery', '/admin/clients', '/admin/billing', '/admin/projects', '/admin/projects/development', '/admin/projects/product-design', '/admin/projects/seo', '/admin/reviews', '/admin/reviews/login', '/admin/records'],
};
if (ROLE !== 'all' && !GROUPS[ROLE]) throw new Error('QA_ROLE must be all, public, client, or admin');
const additional = (process.env.QA_EXTRA_ROUTES || '').split(',').map(s=>s.trim()).filter(s=>s.startsWith('/'));
const routes = ROLE==='all' ? Object.entries(GROUPS).flatMap(([group,paths])=>paths.map(path=>({group,path}))) : GROUPS[ROLE].map(path=>({group:ROLE,path}));
for (const path of additional) routes.push({group:'extra',path});
await mkdir(OUT,{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true});
try {
 for (const viewport of VIEWPORTS) {
  for (const group of [...new Set(routes.map(x=>x.group))]) {
   const preferred = process.env.QA_STORAGE_STATE || resolve(`qa-artifacts/sessions/${group}.json`);
   let state;
   if (group!=='public') {try {await access(preferred);state=preferred;}catch {state=undefined;}}
   const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,reducedMotion:'reduce',...(state?{storageState:state}:{})});
   const page=await context.newPage();
   for (const {path} of routes.filter(x=>x.group===group)) {
    const errors=[];
    const onError=e=>errors.push(String(e?.message||e).slice(0,160));
    page.on('pageerror',onError);
    let response=null, issue='';
    try {response=await page.goto(new URL(path,SITE).href,{waitUntil:'domcontentloaded',timeout:25000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);}catch(e){issue=String(e.message).slice(0,200);}
    const currentPath=new URL(page.url()).pathname;
    const authRedirect=path!==currentPath && (/\/(login|sign-in)/.test(currentPath));
    let metrics={};
    try {metrics=await page.evaluate(()=>{
      const css=s=>{const el=document.querySelector(s); if(!el)return null;const c=getComputedStyle(el);const r=el.getBoundingClientRect();return {fontFamily:c.fontFamily,fontSize:c.fontSize,lineHeight:c.lineHeight,fontWeight:c.fontWeight,color:c.color,background:c.backgroundColor,paddingTop:c.paddingTop,paddingBottom:c.paddingBottom,borderRadius:c.borderRadius,height:Math.round(r.height)};};
      const section=[...document.querySelectorAll('main section,main .ds-section')].find(x=>x.getBoundingClientRect().height>0);
      return {title:document.title,h1:css('h1'),h2:css('h2'),body:css('body'),button:css('button,.button-primary,.rp-unified-button'),card:css('.surface-card,.ds-card,.rounded-card,.ds-admin-panel'),section:section?{tag:section.tagName,className:String(section.className).slice(0,100),...css('main section,main .ds-section')}:null,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
    });}catch(e){issue ||= String(e.message).slice(0,200);}
    const slug=path==='/'?'home':path.slice(1).replaceAll(/[^a-z0-9]+/gi,'-');
    const filename=`${group}-${viewport.name}-${slug}.png`;
    let screenshot=null;
    if(response?.ok()) {try {await page.screenshot({path:join(OUT,filename),fullPage:true,animations:'disabled',timeout:30000});screenshot=filename;}catch(e){issue ||= `screenshot: ${String(e.message).slice(0,120)}`;}}
    results.push({group,route:path,viewport:viewport.name,width:viewport.width,status:response?.status()||null,finalPath:currentPath,authRedirect,sessionProvided:!!state,screenshot,errors,issue,...metrics});
    page.off('pageerror',onError);
   }
   await context.close();
  }
 }
}finally {await browser.close();}
await writeFile(join(OUT,'metrics.json'),JSON.stringify(results,null,2));
const gallery=results.map(r=>`<article><h2>${r.group} · ${r.viewport} · ${r.route}</h2><p>HTTP ${r.status??'—'} | ${r.authRedirect?'LOGIN REDIRECT':r.issue||'captured'} | ${r.h1?.fontSize||'no H1'}</p>${r.screenshot?`<a href="${r.screenshot}"><img loading="lazy" src="${r.screenshot}" alt="Screenshot of ${r.route}"></a>`:'<p>No screenshot</p>'}</article>`).join('');
await writeFile(join(OUT,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>RapidlyOn full-site QA screenshots</title><style>body{font:15px system-ui;background:#edf7f7;color:#153a40;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{background:white;border-radius:16px;padding:16px;box-shadow:0 4px 20px #12404a14;min-width:0}img{width:100%;border:1px solid #cadfdf}p{font-size:13px;color:#566}h2{font-size:16px;overflow-wrap:anywhere}</style><h1>RapidlyOn screenshots — ${results.length} route/viewport checks</h1><p>Private screens may redirect to login when storage state is unavailable. Do not publish a gallery containing client/admin data.</p><main>${gallery}</main></html>`);
console.table(results.map(({group,route,viewport,status,authRedirect,overflow,issue})=>({group,route,viewport,status,authRedirect,overflow,issue:issue?'ERROR':'—'})));
console.log(`Screenshots: ${OUT}/index.html | Metrics: ${OUT}/metrics.json`);
const failures=results.filter(r=>!r.status||r.status>=500||r.overflow||r.issue);
console.log(`${results.length} checks; ${failures.length} network / overflow / capture issues; ${results.filter(r=>r.authRedirect).length} auth redirects (not visual approvals).`);
if(failures.length)process.exitCode=1;
