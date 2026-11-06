/* Capture the real external reference on a computer that can reach the site. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
const output=resolve('qa-artifacts/summit-reference');
await mkdir(output,{recursive:true});
const url='https://summitfamilydentalcare.com/vip-program';
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
  const computed=await page.evaluate(()=>{
   const style=s=>{const el=document.querySelector(s);if(!el)return null;const c=getComputedStyle(el);return {font:c.fontFamily,size:c.fontSize,weight:c.fontWeight,leading:c.lineHeight,tracking:c.letterSpacing,color:c.color,background:c.backgroundColor,radius:c.borderRadius,padding:c.padding}};
   const hist={};for(const el of document.querySelectorAll('section,header,main,button,a')){const bg=getComputedStyle(el).backgroundColor;if(bg&&bg!=='rgba(0, 0, 0, 0)'){hist[bg]=(hist[bg]||0)+1;}}
   return {title:document.title,body:style('body'),h1:style('h1'),h2:style('h2'),nav:style('header'),button:style('button'),section:style('section'),frequentBackgrounds:Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,16)};
  });
  await page.screenshot({path:join(output,`reference-${width}.png`),fullPage:true,animations:'disabled'});
  results.push({width,status:response?.status(),url,...computed});
  await context.close();
 }
}finally{await browser.close();}
await writeFile(join(output,'computed-styles.json'),JSON.stringify(results,null,2));
console.log(`Reference screenshots and measured styles saved to ${output}`);
