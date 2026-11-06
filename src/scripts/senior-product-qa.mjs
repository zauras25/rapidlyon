/** Browser-level product UX checks; run while `npm run dev` is running. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.env.QA_BASE_URL||'http://localhost:3000';
const out=resolve('qa-artifacts/senior-product');
const routes=['/','/services','/work','/pricing','/process','/about','/contact','/discovery'];
const viewports=[{name:'mobile',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1440,height:900}];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const results=[];
try {
  for(const size of viewports){
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},reducedMotion:'reduce'});
    const page=await context.newPage();
    for(const route of routes){
      const issues=[];const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
      let status=null,screenshot=null,metrics={};
      try{
        const response=await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded',timeout:25000});status=response?.status()??null;
        await page.evaluate(()=>document.fonts.ready);
        metrics=await page.evaluate(()=>{
          const interactive=[...document.querySelectorAll('a[href],button,input,select,textarea')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'});
          const unlabeled=interactive.filter(e=>{if(e.tagName==='A')return !((e.textContent||'').trim()||e.getAttribute('aria-label')||e.querySelector('img[alt]'));if(e.tagName==='BUTTON')return !((e.textContent||'').trim()||e.getAttribute('aria-label')||e.getAttribute('title'));if(['INPUT','SELECT','TEXTAREA'].includes(e.tagName))return !((e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length||e.getAttribute('title')));return false;});
          const tiny=interactive.filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<24;}).length;
          return {title:document.title,h1:document.querySelectorAll('main h1').length,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,unlabeledControls:unlabeled.length,tinyTargets:tiny,imagesMissingAlt:document.querySelectorAll('img:not([alt])').length,mainLandmarks:document.querySelectorAll('main').length,buttons:document.querySelectorAll('button').length};
        });
        if((status||0)>=400)issues.push('HTTP '+status);
        if(metrics.scrollWidth>metrics.clientWidth+2)issues.push('horizontal overflow '+(metrics.scrollWidth-metrics.clientWidth)+'px');
        if(metrics.h1!==1)issues.push('expected exactly one main H1, found '+metrics.h1);
        if(metrics.mainLandmarks!==1)issues.push('expected one main landmark');
        if(metrics.unlabeledControls)issues.push(metrics.unlabeledControls+' unlabeled visible controls');
        if(metrics.imagesMissingAlt)issues.push(metrics.imagesMissingAlt+' images without alt attribute');
        const name=(route==='/'?'home':route.slice(1));screenshot=`${size.name}-${name}.png`;
        await page.screenshot({path:resolve(out,screenshot),fullPage:true,animations:'disabled'});
      }catch(e){issues.push(String(e.message||e).slice(0,300));}
      if(pageErrors.length)issues.push(pageErrors.length+' JS page errors');
      results.push({route,viewport:size.name,status,screenshot,metrics,issues});page.removeAllListeners('pageerror');
      console.log(`${size.name} ${route}: ${issues.length?'ISSUES '+issues.join('; '):'PASS'}`);
    }
    await context.close();
  }
}finally{await browser.close()}
await writeFile(resolve(out,'report.json'),JSON.stringify({base,generatedAt:new Date().toISOString(),results},null,2));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards=results.map(x=>`<article><h2>${escape(x.viewport)} · ${escape(x.route)}</h2><p>${x.issues.length?escape(x.issues.join('; ')):'PASS'}</p>${x.screenshot?`<img loading="lazy" alt="${escape(x.route)} screenshot" src="${escape(x.screenshot)}">`:''}</article>`).join('');
await writeFile(resolve(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RapidlyOn Senior Product QA</title><style>body{font:15px system-ui;background:#f5f6f4;color:#162f27;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:20px}article{background:white;border:1px solid #dce5df;border-radius:12px;padding:16px;min-width:0}img{width:100%;height:auto}h2{font-size:17px}p{overflow-wrap:anywhere}</style><h1>RapidlyOn — Product QA</h1><main>${cards}</main></html>`);
const failures=results.filter(x=>x.issues.length);console.log(`Results: ${results.length} route/viewport checks; ${failures.length} with issues. Open ${out}/index.html`);
if(failures.length)process.exitCode=1;
