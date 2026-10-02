import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');

assert.match(source,/function xtreamAccountId\s*\(item\)/,'Playlist Manager must derive Xtream account identity from typed Saved Playlist data');
assert.match(source,/item\.type\s*===\s*['"]xtream['"]/,'Playlist Manager must branch on typed Xtream Saved Playlist rows');
assert.match(source,/Load live/,'Xtream Library cards must render Load live');
assert.match(source,/WebTVXtream\?\.loadAccountById\s*\(accountId\)|WebTVXtream\.loadAccountById\s*\(accountId\)/,'Load live must delegate to the Xtream account loader');
assert.match(source,/icon\.textContent\s*=\s*[^;]*['"]👤['"]/,'Xtream Library cards must render an Xtream/person icon');

const renderBlock=source.split('async function renderSaved(){')[1]?.split('async function startup(){')[0]||'';
assert.match(renderBlock,/xtreamAccountId\s*\(item\)/,'renderSaved must use the Xtream account reference helper');
assert.match(renderBlock,/Export/,'normal Saved Playlist cards must retain Export');
assert.match(renderBlock,/if\s*\(!?accountId|isXtream/,'Xtream branch must distinguish account-backed entries');

const loadBlock=source.split('async function loadSavedItem(item)')[1]?.split('async function exportSavedItem(item)')[0]||'';
assert.doesNotMatch(loadBlock,/item\.type\s*===\s*['"]xtream['"][\s\S]*applyText\s*\(item\.text/,'Xtream marker M3U must never be applied as a normal playlist');

assert.doesNotMatch(renderBlock,/item\.name[\s\S]{0,120}xtreamAccount/i,'Xtream account identity must not be recovered from title text');
console.log('Playlist Manager Xtream Library ownership PASS');
