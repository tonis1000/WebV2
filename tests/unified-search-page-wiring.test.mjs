import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(match=>match[1]);
const searchScripts=scripts.filter(src=>src.includes('/src/search/search-ui.js')||src.includes('./src/search/search-ui.js'));
assert.equal(searchScripts.length,1,'index must load Unified Search exactly once as its own top-level module');
const mainIndex=scripts.findIndex(src=>src.includes('./src/main.js'));
const searchIndex=scripts.findIndex(src=>src.includes('./src/search/search-ui.js'));
assert.ok(mainIndex>=0&&searchIndex>mainIndex,'Unified Search must load after main playback API owner');
assert.equal(/Find Official Sources|discovery-scan-official/.test(html),false,'index must not introduce Official controls into Unified Search');
assert.ok(/unified-search\.css\?v=20260930-unified-search-a/.test(html),'index must load the dedicated Unified Search stylesheet');
assert.equal((html.match(/unified-search\.css\?v=20260930-unified-search-a/g)||[]).length,1,'Unified Search stylesheet should be linked once');

console.log('unified search page wiring contract PASS');
