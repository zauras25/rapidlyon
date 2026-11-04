/** Run AFTER `npm run dev`, and after `npm ci` installed Playwright. No fake screenshots or mocked auth. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const BASE=process.env.QA_BASE_URL||'http://localhost:3000';
const output=path.resolve('qa-artifacts/v4');
const paths=['/','/services','/work','/pricing','/about','/process','/contact','/discovery','/faq','/insights','/privacy','/terms','/design-system','/admin/discovery/login','/client/login','/client/sign-up'];
const sizes=[{name:'desktop',width:1440,height:900},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}];
const failures=[],stats=[];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
for(const viewport of sizes){const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce',deviceScaleFactor:1});const page=await context.newPage();
for(const route of paths){let status=0;let width=0;let heading=0;const name=(route.slice(1)||'home').replace(/\//g,'-');try{
 const response=await page.goto(BASE+route,{waitUntil:'networkidle',timeout:20000});status=response?.status()??0;
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,`${name}-${viewport.name}.png`),fullPage:true,animations:'disabled',timeout:15000});
 const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('main h1, .auth-layout h1').length}));width=metrics.scrollWidth;heading=metrics.h1;
 if(status>=400||status===0)failures.push(`${route} ${viewport.name}: HTTP ${status}`);
 if(width>viewport.width+2)failures.push(`${route} ${viewport.name}: horizontal overflow ${width}px > ${viewport.width}px`);
 if(heading===0)failures.push(`${route} ${viewport.name}: missing main heading`);
 }catch(error){failures.push(`${route} ${viewport.name}: ${error instanceof Error?error.message:'unknown error'}`)}
 stats.push({route,viewport:viewport.name,status,heading,scrollWidth:width});console.log(`${viewport.name} ${route} — ${status} — width ${width}`)
}await context.close()}
}finally{await browser.close()}
const report={base:BASE,generatedAt:new Date().toISOString(),screenshots:stats.length,checks:stats,failures};
await fs.writeFile(path.join(output,'qa-report.json'),JSON.stringify(report,null,2));
console.log(`QA finished: ${stats.length} captures; ${failures.length} issues. Report: ${output}/qa-report.json`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
