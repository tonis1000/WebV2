import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../src/xtream-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../playlist-manager.css',import.meta.url),'utf8');

assert.match(ui,/class="playlist-actions xtream-preview-save-actions"/,'Xtream preview persistence actions need a dedicated layout owner');
assert.match(css,/\.xtream-preview-save-actions\s*\{[^}]*display:grid[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)[^}]*\}/,'desktop Xtream preview save actions must use three non-overlapping grid columns');
assert.match(css,/\.xtream-preview-save-actions \.button\s*\{[^}]*min-width:0[^}]*width:100%[^}]*white-space:normal[^}]*\}/,'preview action buttons must stay inside their own hit area');
assert.match(css,/@media\(max-width:560px\)[\s\S]*\.xtream-preview-save-actions\s*\{[^}]*grid-template-columns:1fr[^}]*\}/,'narrow layout must stack preview save actions');

console.log('Xtream preview action layout ownership PASS');
