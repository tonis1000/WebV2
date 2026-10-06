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
assert.match(epg,/const urls = \[primary\]/,'frontend EPG refresh must have one Worker-owned fetch lane');\nassert.match(epg,/now-next\.json/,'viewer EPG must use the compact Worker endpoint');\nassert.match(epg,/refreshGuide/,'full Guide refresh must remain explicit and Worker-owned');
assert.match(guide,/webtv:admin-controls-changed/,'EPG Guide must notify presentation when its admin control is created');
assert.match(rail,/webtv:admin-controls-changed/,'desktop rail must re-dock late-created admin controls');

const recoveryVersion='20261006-epg-performance-a';
assert.match(main,new RegExp(`core\\/epg\\.js\\?v=${recoveryVersion}`),'main must load the recovery EPG core');
assert.match(sidebar,new RegExp(`core\\/epg\\.js\\?v=${recoveryVersion}`),'sidebar must share the same recovery EPG core');
assert.match(index,new RegExp(`main\\.js\\?v=${recoveryVersion}`),'page must cache-bust the canonical EPG runtime');
assert.match(index,new RegExp(`sidebar-now\\.js\\?v=${recoveryVersion}`),'page must cache-bust the sidebar EPG consumer');
assert.match(index,new RegExp(`src\\/core\\/epg\\.js\\?v=${recoveryVersion}`),'import map must not point EPG at an older cached runtime');
assert.match(epg,/EPG_FETCH_RETRY_DELAYS_MS/,'EPG runtime must retry transient Worker failures');
assert.match(epg,/sanitizeXmltvForBrowser/,'EPG runtime must recover from provider XML that is readable but not strict-browser-XML');
assert.match(epg,/epg-retry/,'retry requests must bypass a stale cached Worker response');

console.log('EPG browser boundary + recovery/cache-coherence contract PASS');
