import fs from 'node:fs';
import path from 'node:path';
const base=process.cwd();
const css=fs.readFileSync(path.join(base,'src/design-system/tokens.css'),'utf8');
const json=JSON.parse(fs.readFileSync(path.join(base,'figma-handoff/canonical-live-tokens.json'),'utf8'));
const vars=Object.entries(json.tokens);
let failures=0;
for(const [n,v] of vars){if(!css.includes(`--${n}:`)){console.error('Missing CSS token',n);failures++;}const match=String(v.$value).match(/^var\((--[\w-]+)\)$/);if(match&&!css.includes(match[1]+':')){console.error('Unresolved alias',n,match[1]);failures++;}}
for(const p of ['figma-variables-light.csv','figma-component-inventory.csv','figma-variables-dark-overrides.csv']){if(!fs.existsSync(path.join(base,'figma-handoff',p)))failures++;}
console.log(`Figma handoff: ${vars.length} live tokens; ${failures} failures.`);
console.warn('NOTE: src/design-tokens.json is legacy and not canonical. CSS hardcodes and interaction states require manual audit.');
process.exitCode=failures?1:0;
