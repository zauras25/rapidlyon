import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3000';
const out = resolve('qa-artifacts/qa-fixes');
await mkdir(out,{recursive:true});
const sizes=[['mobile',390,844],['tablet',768,1024],['desktop',1440,900]];
const routes=['/','/services','/work','/pricing','/process','/about','/contact','/discovery'];
const results=[];
const browser=await chromium.launch({headless:true});
try {
  for(const [device,width,height] of sizes){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    for(const route of routes){
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const entry={route,device,errors,issues:[]};
      try {
        const response=await page.goto(new URL(route,base).href,{waitUntil:'networkidle',timeout:30000});
        entry.http=response?.status();
        await page.evaluate(()=>document.fonts.ready);
        entry.metrics=await page.evaluate(()=>{
          const interactive=[...document.querySelectorAll('a[href],button,input,textarea,select,summary')];
          const tiny=interactive.filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&(r.width<24||r.height<24)});
          function path(e){if(e.id)return '#'+e.id;const cls=typeof e.className==='string' ? e.className.split(/\s+/).filter(Boolean).slice(0,3).join('.') : '';return e.tagName.toLowerCase()+(cls?'.'+cls:'')+' '+(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,36)}
          return {h1:document.querySelectorAll('main h1').length,mains:document.querySelectorAll('main').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,tiny:tiny.slice(0,30).map(e=>({selector:path(e),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})),tinyCount:tiny.length};
        });
        if((entry.http||0)>=400)entry.issues.push(`HTTP ${entry.http}`);
        if(entry.metrics.h1!==1)entry.issues.push(`H1 count ${entry.metrics.h1}`);
        if(entry.metrics.mains!==1)entry.issues.push(`main count ${entry.metrics.mains}`);
        if(entry.metrics.overflow>2)entry.issues.push(`overflow ${entry.metrics.overflow}px`);
        if(errors.length)entry.issues.push(`${errors.length} JS errors`);
        const filename=`${device}-${route==='/'?'home':route.substring(1)}.png`;
        await page.screenshot({path:resolve(out,filename),fullPage:true,animations:'disabled'});
        entry.screenshot=filename;
        if(device==='mobile'&&route==='/'){
          const menu=page.getByRole('button',{name:/open menu/i});
          if(await menu.count()){
            await menu.click();
            entry.menuOpened=await menu.getAttribute('aria-expanded')==='true';
            await page.keyboard.press('Escape');
            entry.menuClosed=await menu.getAttribute('aria-expanded')==='false';
            if(!entry.menuOpened||!entry.menuClosed) entry.issues.push('mobile menu open/Escape regression');
          }else entry.issues.push('mobile menu trigger missing');
        }
      }catch(e){entry.issues.push(String(e.message||e).slice(0,200))}
      results.push(entry);
      console.log(`${device} ${route}: ${entry.issues.length?entry.issues.join('; '):'PASS'} (${entry.metrics?.tinyCount??'?'} small controls)`);
      await page.close();
    }
    await context.close();
  }
}finally{await browser.close()}
await writeFile(resolve(out,'report.json'),JSON.stringify({base,at:new Date().toISOString(),results},null,2));
const html=`<!doctype html><meta charset="utf-8"><title>RapidlyOn QA fix verification</title><style>body{font:15px system-ui;margin:24px;background:#f5f6f3}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}article{background:white;padding:15px;border-radius:12px;border:1px solid #ddd}img{width:100%}pre{white-space:pre-wrap}</style><h1>RapidlyOn QA Fix Verification</h1><main>${results.map(r=>`<article><h2>${r.device} ${r.route}</h2><p>${r.issues.join(' | ')||'PASS'}</p><p>Small controls: ${r.metrics?.tinyCount??'n/a'}</p><details><summary>Small controls</summary><pre>${JSON.stringify(r.metrics?.tiny||[],null,2).replaceAll('<','&lt;')}</pre></details>${r.screenshot?`<img src="${r.screenshot}" alt="Screenshot">`:''}</article>`).join('')}</main>`;
await writeFile(resolve(out,'index.html'),html);
const failures=results.filter(r=>r.issues.length);
console.log(`Complete: ${results.length} route/device checks; ${failures.length} failures. Report: ${out}/index.html`);
if(failures.length)process.exitCode=1;
