import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const legacy=readFileSync(new URL('../src/app/rapidlyon-redesign.css',import.meta.url),'utf8');
const tokens=readFileSync(new URL('../src/app/unified-design-system.css',import.meta.url),'utf8');
test('legacy primary navigation and card surfaces use shared tokens',()=>{for(const key of ['--component-nav-bg','--component-navigation-active-bg','--component-card-bg','--component-card-border'])assert.ok(legacy.includes('var('+key+')'),key)});
test('contact and login inputs use component roles',()=>{assert.ok((legacy.match(/var\(--component-input-bg\)/g)||[]).length >= 2);assert.ok(legacy.includes('var(--component-input-border)'))});
test('admin table headings and sidebar have semantic roles',()=>{for(const key of ['--component-table-heading-text','--component-sidebar-text','--component-sidebar-label']) assert.ok(legacy.includes('var('+key+')'),key)});
test('light/dark sidebar label tokens exist',()=>{assert.match(tokens,/--semantic-text-inverse-muted:/);assert.match(tokens,/:root\[data-theme="dark"\]/)});
