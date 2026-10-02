import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/xtream-ui.js',import.meta.url),'utf8');

assert.match(source,/async function loadAccountById\s*\(accountId\)/,'Xtream UI must define one shared loadAccountById(accountId) path');
assert.match(source,/window\.WebTVXtream\s*=\s*\{[\s\S]*\bloadAccountById\b/,'Xtream public API must expose loadAccountById');
assert.match(source,/async function loadSelectedAccount\s*\(\)[\s\S]*?loadAccountById\s*\(accountId\)/,'selector loading must delegate to loadAccountById(accountId)');

const loadBlock=source.split('async function loadAccountById(accountId) {')[1]?.split('async function loadSelectedAccount() {')[0]||'';
assert.match(loadBlock,/loadXtreamChannels\s*\(id\)/,'shared loader must own saved-account channel loading');
for(const forbidden of ['saveXtreamAccount(','saveXtreamAccountFromPreview(','WebTVMyPlaylistAPI','upsertCustomPlaylistChannel']){
  assert.equal(loadBlock.includes(forbidden),false,`saved-account loading must not persist through ${forbidden}`);
}

const selectedBlock=source.split('async function loadSelectedAccount() {')[1]?.split('async function removeSelectedAccount() {')[0]||'';
assert.equal(selectedBlock.includes('loadXtreamChannels('),false,'selector wrapper must not keep a second saved-account loader');

console.log('Xtream account load ownership PASS');
