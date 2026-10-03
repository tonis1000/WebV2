import assert from 'node:assert/strict';
import fs from 'node:fs';

const config=fs.readFileSync(new URL('../src/config.js',import.meta.url),'utf8');
const epg=fs.readFileSync(new URL('../src/core/epg.js',import.meta.url),'utf8');
const guide=fs.readFileSync(new URL('../src/epg-guide.js',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const sidebar=fs.readFileSync(new URL('../src/sidebar-now.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(config,/epgUrl:\s*'https:\/\/epg-proxy-gr\.atonis\.workers\.dev\/epg\.xml'/,'browser EPG must use the canonical Worker');
assert.doesNotMatch(config,/epgFallbackUrl:\s*'https:\/\/ext\.greektv\.app/,'browser config must not expose GreekTV as a direct fallback');
assert.doesNotMatch(epg,/ext\.greektv\.app|epgshare01|digea\.gr|cosmotetv/i,'frontend EPG owner must not know upstream provider URLs');
assert.match(epg,/const urls = \[primary\]/,'frontend EPG refresh must have one Worker-owned fetch lane');
assert.match(guide,/webtv:admin-controls-changed/,'EPG Guide must notify presentation when its admin control is created');
assert.match(rail,/webtv:admin-controls-changed/,'desktop rail must re-dock late-created admin controls');
assert.match(main,/core\/epg\.js\?v=20261003-worker-only/,'main must load the Worker-only EPG core');
assert.match(sidebar,/core\/epg\.js\?v=20261003-worker-only/,'sidebar must share the same Worker-only EPG core');
assert.match(index,/main\.js\?v=20261003-epg-worker-only/,'page must cache-bust the canonical EPG runtime');
assert.match(index,/sidebar-now\.js\?v=20261003-epg-worker-only/,'page must cache-bust the sidebar EPG consumer');

console.log('EPG browser boundary + admin rail contract PASS');
