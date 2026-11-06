import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = name => readFileSync(new URL(`../src/app/${name}`, import.meta.url), "utf8");
test("Round 4: client navigation and process states use semantic tokens", () => {
 const s=css("rapidlyon-phase4.css");
 for (const raw of ["#3c594b", "#ecf7cc", "#a9bc9f", "#b9cfb5", "#d4e0cf"]) assert.ok(!s.includes(raw), `legacy ${raw}`);
 assert.match(s, /\.rp-client-jump-nav a:hover\{border-color:var\(--semantic-border-strong\)/);
});
test("Round 4: legacy V3 focus and secondary buttons share tokens", () => {
 const s=css("rapidlyon-unified-v3.css");
 assert.match(s, /outline:3px solid var\(--component-focus-outline\)/);
 assert.match(s, /border-color:var\(--component-button-secondary-border\)!important/);
});
test("Round 4: semantic border and focus tokens exist", () => {
 const s=css("unified-design-system.css");
 assert.match(s, /--semantic-border-strong:/);
 assert.match(s, /--component-focus-outline:/);
});
