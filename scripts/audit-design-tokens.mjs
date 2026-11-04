import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = process.cwd();
function walk(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(join(dir,e.name)): e.name.endsWith('.css')?[join(dir,e.name)]:[]); }
const files=walk(join(root,'src'));
const declaration = /(--[\w-]+)\s*:/g;
const use = /var\(\s*(--[\w-]+)/g;
const defs=new Set();
for (const path of files) { const content=readFileSync(path,'utf8'); for(const match of content.matchAll(declaration))defs.add(match[1]); }
const missing=new Map(); const literal=[];
for(const path of files) {
 const content=readFileSync(path,'utf8');const name=relative(root,path); const lines=content.split('\n');
 for(let i=0;i<lines.length;i++) {
  const line=lines[i];
  for(const m of line.matchAll(use)) if(!defs.has(m[1])&&!m[1].startsWith('--tw-')&&!m[1].startsWith('--font-')){ const key=m[1]; if(!missing.has(key))missing.set(key,[]);missing.get(key).push(`${name}:${i+1}`); }
  if(/#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(line)&& !name.endsWith('unified-design-system.css')) literal.push({file:name,line:i+1,source:line.trim().slice(0,180)});
 }
}
const result={cssFiles:files.length,unresolvedTokens:[...missing].map(([token,locations])=>({token,locations:locations.slice(0,6)})),rawColorOccurrences:literal.length,rawColors:literal};
writeFileSync('DESIGN_TOKEN_PHASE5_AUDIT.json',JSON.stringify(result,null,2)+'\n');
console.log(`Audited ${files.length} CSS files; ${missing.size} unresolved variable names; ${literal.length} literal-color lines (includes visual art).`);
if(process.argv.includes('--strict')&&missing.size) process.exitCode=1;
