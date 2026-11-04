/* Use only locally: saved storage state contains session cookies. Never share it. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
const role=process.argv.includes('--client')?'client':'admin';
const base=process.env.QA_BASE_URL || 'http://localhost:3000';
const target=role==='admin'?'/admin/discovery/login':'/client/login';
const output=resolve(`qa-artifacts/sessions/${role}.json`);
await mkdir(resolve('qa-artifacts/sessions'),{recursive:true});
const browser=await chromium.launch({headless:false});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(new URL(target,base).href);
 console.log(`Sign in to your ${role} account in the opened browser. Then return here.`);
 const rl=createInterface({input:process.stdin,output:process.stdout});
 await rl.question('After successful login, press Enter to save LOCAL cookies: ');
 rl.close();
 await context.storageState({path:output});
 console.log(`Saved session: ${output} (SECRET: do not upload / commit / publish)`);
}finally{await browser.close();}
