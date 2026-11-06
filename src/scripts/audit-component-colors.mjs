import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('../src', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name.startsWith('.')) return [];
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : /\.(css|tsx)$/.test(entry.name) ? [path] : [];
});
const matches = [];
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/(#[\da-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\()/.test(line)) return;
    if (file.endsWith('unified-design-system.css')) return; // primitives/mode definitions
    matches.push({ file: relative(root, file), line: i + 1, sample: line.trim().slice(0, 160) });
  });
}
console.log(JSON.stringify({ total: matches.length, entries: matches }, null, 2));
