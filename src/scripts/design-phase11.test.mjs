import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../src/app/unified-design-system.css");
const css = read("../src/app/globals.css");
const layout = read("../src/app/layout.tsx");
const switcher = read("../src/components/ui/theme-switch.tsx");
test("button/card/input design tokens use semantic aliases", () => {
 for (const [component,semantic] of Object.entries({
  "--component-button-primary-bg":"--semantic-brand-primary",
  "--component-card-bg":"--semantic-bg-surface",
  "--component-input-border":"--semantic-border-default"
 })) assert.ok(tokens.includes(`${component}: var(${semantic})`),component);
});
test("existing UI consumers remain connected to component aliases", () => {
 for (const name of ["--component-button-primary-bg","--component-button-secondary-bg","--component-card-bg","--component-input-border"]) assert.ok(css.includes(`var(${name})`),name);
});
test("theme bootstrap falls back to system preference if storage fails", () => {
 assert.match(layout, /catch\(e\)\{try\{document\.documentElement\.dataset\.theme=window\.matchMedia/);
});
test("theme switch tolerates unavailable matchMedia while syncing tabs", () => {
 assert.match(switcher, /try \{ return window\.matchMedia/);
 assert.match(switcher, /media\.addEventListener/);
 assert.match(switcher, /window\.addEventListener\("storage"/);
});
