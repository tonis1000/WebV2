import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
assert.match(source,/['"]&quot;['"]/, 'playlist-manager escapeHtml must preserve the complete quote entity');
console.log('playlist manager HTML escaping PASS');
