import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/app/studio-os.css", import.meta.url), "utf8");
test("admin studio surface and controls use semantic roles", () => {
  assert.match(css, /\.r-os-topbar\{[^}]*var\(--semantic-bg-surface\)/);
  assert.match(css, /\.r-os-primary\{[^}]*var\(--component-button-primary-bg\)/);
  assert.match(css, /\.r-os-table th\{[^}]*var\(--semantic-bg-subtle\)/);
});
test("admin studio status surfaces inherit theme colors", () => {
  assert.match(css, /\.r-os-status\.cancelled\{[^}]*var\(--semantic-status-danger-bg\)/);
  assert.match(css, /\.r-os-status\.paused[^}]*var\(--semantic-status-warning-bg\)/);
});
test("admin studio overlays use centralized semantic scrim", () => {
  assert.match(css, /\.r-os-overlay\{[^}]*var\(--semantic-overlay-scrim\)/);
});
