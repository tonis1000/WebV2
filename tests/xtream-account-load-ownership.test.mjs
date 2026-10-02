import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/xtream-ui.js',import.meta.url),'utf8');

assert.match(source,/async function loadAccountById\s*\(accountId\)/,'Xtream UI must define one shared loadAccountById(accountId) path');
assert.match(source,/window\.WebTVXtream\s*=\s*\{[\s\S]*\bloadAccountById\b/,'Xtream public API must expose loadAccountById');
assert.match(source,/async function loadSelectedAccount\s*\(\)[\s\S]*?loadAccountById\s*\(accountId\)/,'selector loading must delegate to loadAccountById(accountId)');

const loadBlock=source.match(/async function loadAccountById\s*\(accountId\)\s*\{([\s\S]*?)\n\}/)?.[1]||'';
assert.match(loadBlock,/loadXtreamChannels\s*\(accountId\)/,'shared loader must own saved-account channel loading');
for(const forbidden of ['saveXtreamAccount(','saveXtreamAccountFromPreview(','WebTVMyPlaylistAPI','upsertCustomPlaylistChannel']){
  assert.equal(loadBlock.includes(forbidden),false,`saved-account loading must not persist through ${forbidden}`);
}

const selectedBlock=source.match(/async function loadSelectedAccount\s*\(\)\s*\{([\s\S]*?)\n\}/)?.[1]||'';
assert.equal(selectedBlock.includes('loadXtreamChannels(accountId)'),false,'selector wrapper must not keep a second saved-account loader');

console.log('Xtream account load ownership PASS');
