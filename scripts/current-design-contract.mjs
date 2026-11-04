import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = path => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const tokens = read("src/design-system/tokens.css");
const styles = read("src/styles/globals.css");
const button = read("src/components/ui/button.tsx");
const admin = read("src/components/console/admin-workflows.tsx");
const client = read("src/components/console/client-console.tsx");
const chrome = read("src/components/site/chrome.tsx");
const publicPages = read("src/components/site/public-pages.tsx");

export function assertCurrentDesignContract(area) {
  if (area === "canonical") {
    const snapshot = JSON.parse(read("figma-handoff/canonical-live-tokens.json"));
    for (const token of Object.values(snapshot.tokens)) {
      const variable = token.$extensions?.rapidlyon?.cssVariable;
      if (!variable) continue;
      const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const value = tokens.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`))?.[1]?.trim();
      assert.equal(value, token.$value, `${variable} differs from the canonical live token`);
    }
  } else if (area === "theme") {
    assert.match(tokens, /\[data-theme=['"]dark['"]\]/);
    for (const name of ["--color-bg", "--color-text", "--color-brand", "--button-primary-bg"]) {
      assert.match(tokens, new RegExp(`${name}\\s*:`));
    }
  } else if (area === "typography") {
    for (const name of ["--font-display", "--font-body", "--text-h1", "--text-h2", "--text-body"]) {
      assert.match(tokens, new RegExp(`${name}\\s*:`));
    }
    assert.match(styles, /font:400 var\(--text-body\)\/var\(--line-body\) var\(--font-body\)/);
  } else if (area === "spacing") {
    for (const name of ["--space-1", "--space-4", "--space-8", "--section-spacing"]) {
      assert.match(tokens, new RegExp(`${name}\\s*:`));
    }
    assert.match(styles, /var\(--space-(?:4|6|8|12|16)\)/);
  } else if (area === "buttons") {
    assert.match(button, /variant\?: "primary" \| "secondary" \| "outline"/);
    assert.match(button, /ds-button--\$\{variant\}/);
    assert.match(styles, /\.btn-dark/);
    assert.match(tokens, /--button-primary-bg:/);
  } else if (area === "forms") {
    assert.match(tokens, /--input-bg/);
    assert.match(tokens, /--input-border/);
    assert.match(styles, /\.form-field/);
  } else if (area === "accessibility") {
    assert.match(styles, /:focus-visible/);
    assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  } else if (area === "navigation") {
    assert.match(chrome, /className="site-header"/);
    assert.match(chrome, /site-nav/);
    assert.match(styles, /\.site-nav/);
  } else if (area === "marketing") {
    assert.match(publicPages, /<PageHero/);
    assert.match(styles, /\.hero/);
    assert.match(styles, /var\(--color-brand\)/);
  } else if (area === "admin") {
    assert.match(admin, /workflow-stack/);
    assert.match(admin, /table-shell/);
    assert.match(styles, /\.workflow-stack/);
    assert.match(styles, /\.table-shell/);
  } else if (area === "client") {
    assert.match(client, /Payments & receipts/);
    assert.match(client, /installment_sequence/);
    assert.match(styles, /\.table-shell/);
  } else if (area === "responsive") {
    assert.match(styles, /@media\s*\(max-width:/);
    assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  } else if (area === "images") {
    assert.match(chrome, /import Image from 'next\/image'/);
    assert.match(chrome, /<Image className="brand-wordmark"/);
    assert.match(publicPages, /<Image src=\{m\.src\}/);
  } else if (area === "browser-qa") {
    const qa = read("scripts/browser-design-qa.mjs");
    assert.match(qa, /browser\.newContext/);
    assert.match(qa, /color===expected/);
    assert.match(qa, /\.btn-dark,\.ds-button--primary/);
    assert.match(qa, /entry\.consumers===0/);
    assert.match(qa, /entry\.theme!==mode/);
  } else if (area === "dark-mode-qa") {
    assert.match(tokens, /\[data-theme='dark'\]/);
    assert.match(read("scripts/browser-design-qa.mjs"), /DOMContentLoaded',applyTheme/);
    assert.match(read("scripts/browser-component-qa.mjs"), /DOMContentLoaded', applyTheme/);
  } else {
    throw new Error(`Unknown current design contract: ${area}`);
  }
}
