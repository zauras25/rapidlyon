import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../src/app/unified-design-system.css',import.meta.url),'utf8');
const blocks=[...css.matchAll(/(:root(?:\[data-theme="dark"\])?)\s*\{([^{}]*)\}/g)];
const parse=(dark)=>{const out=new Map();for(const [,selector,body] of blocks){if(selector!==':root' && !(dark&&selector===':root[data-theme="dark"]'))continue;for(const [,name,value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))out.set(name,value.trim());}return out;};
const resolve=(map,name,seen=new Set())=>{assert.ok(map.has(name),`Undefined token ${name}`);assert.ok(!seen.has(name),`Cycle ${[...seen,name].join(' -> ')}`);const s=new Set([...seen,name]);return map.get(name).replace(/var\((--[\w-]+)(?:\s*,\s*([^\)]+))?\)/g,(_,ref,fallback)=>map.has(ref)?resolve(map,ref,s):(fallback??(()=>{throw new Error('Undefined '+ref)})()));};
const rgb=(hex)=>{assert.match(hex,/^#[\da-f]{6}$/i);return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);};
const lum=(hex)=>rgb(hex).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const dark of [false,true]){
 const theme=dark?'dark':'light',map=parse(dark);
 test(`${theme}: primary button foreground/background contrast >= 4.5`,()=>{const bg=resolve(map,'--component-button-primary-bg'),fg=resolve(map,'--component-button-primary-text');assert.ok(contrast(bg,fg)>=4.5,`${theme} contrast ${contrast(bg,fg).toFixed(2)} is insufficient`);});
 test(`${theme}: primary button border inherits its background`,()=>assert.equal(resolve(map,'--component-button-primary-border'),resolve(map,'--component-button-primary-bg')));
 test(`${theme}: card, input and navigation tokens resolve`,()=>{for(const name of ['--component-card-bg','--component-card-border','--component-input-bg','--component-input-focus','--component-nav-bg','--component-sidebar-bg','--component-footer-bg'])assert.ok(resolve(map,name).length>0,name);});
 test(`${theme}: theme-specific page background and main text contrast >= 4.5`,()=>{const bg=resolve(map,'--semantic-bg-page'),fg=resolve(map,'--semantic-text-primary');assert.ok(contrast(bg,fg)>=4.5,`${theme} contrast ${contrast(bg,fg).toFixed(2)}`);});
}
test('light and dark semantic background palette actually differ',()=>assert.notEqual(resolve(parse(false),'--semantic-bg-page'),resolve(parse(true),'--semantic-bg-page')));
test('light and dark primary button actually switch colors',()=>assert.notEqual(resolve(parse(false),'--component-button-primary-bg'),resolve(parse(true),'--component-button-primary-bg')));
