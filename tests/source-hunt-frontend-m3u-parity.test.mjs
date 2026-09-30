import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/source-hunt-engine.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/search/source-registry.js',import.meta.url),'utf8');
const catalog=fs.readFileSync(new URL('../src/search/curated-source-catalog.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');

// Historical frontend adapter remains parse-compatible while retired from active page execution.
assert.match(source,/function\s+extractM3u8\s*\(/,'retired frontend Hunt adapter keeps its historical HLS-only URL extractor for parity/reference');
assert.match(source,/\.m3u8/,'retired frontend exact M3U path remains HLS-focused');
assert.match(source,/function\s+collectFromLooseText\s*\(/,'retired loose-text fallback remains intact for parity/reference');
assert.match(source,/m3u-container\.js/,'retired frontend Hunt adapter still consumes shared M3U container core');
assert.match(source,/parseM3uContainer/,'retired frontend Hunt adapter still consumes parseM3uContainer');
assert.doesNotMatch(source,/function\s+collectFromM3U\([^)]*\)\s*\{\s*const lines\s*=/,'retired frontend adapter must not regain an independent M3U line parser');

// Consolidation ownership: the old browser scanner is no longer active.
assert.doesNotMatch(index,/\.\/src\/source-hunt-engine\.js(?:\?|"|')/,'legacy frontend Hunt M3U scanner must remain retired from active page load');
assert.match(index,/\.\/src\/search\/search-ui\.js\?v=20260930-unified-search-a/,'Unified Search must be the active automatic search surface');
assert.match(registry,/curated-source-catalog\.js/,'Unified Search registry must derive curated sources from the shared source catalog');
assert.match(worker,/curated-source-catalog\.js/,'Discovery Worker must consume the same shared curated source catalog');
assert.match(catalog,/format:'m3u'/,'canonical curated catalog must retain M3U source declarations');

const importMap=index.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/i)?.[1]||'';
assert.match(importMap,/\.\/src\/core\/channel-catalog\.js[^\n]*20260930-strm-e3a/,'browser import map must preserve the current Channel Catalog cache ownership');

console.log('frontend M3U parity + Unified Search ownership PASS');
