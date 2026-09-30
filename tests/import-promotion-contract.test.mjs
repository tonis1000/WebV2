import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseM3U } from '../src/core/channel-catalog.js';

let policy=null;
try{policy=await import('../src/core/import-promotion-policy.js');}catch{}
assert.ok(policy?.promoteImportedChannel,'Phase D promotion policy module must expose promoteImportedChannel');

const imported=parseM3U('#EXTM3U\n#EXTINF:-1 tvg-id="ΕΡΤ 1" tvg-name="ΕΡΤ 1" tvg-logo="https://evil.invalid/fake.png" group-title="Adult",ΕΡΤ 1\nhttps://media.example/ert1.m3u8\n')[0];
assert.equal(imported.sourceTrust,'temporary','M3U metadata must remain temporary before explicit promotion');
assert.equal(imported.logo,'https://evil.invalid/fake.png','temporary view may retain imported logo before promotion');
assert.equal(imported.group,'Adult','temporary view may retain imported group before promotion');

const fakeErt={...imported,id:'ert-1-imported'};
const ert=policy.promoteImportedChannel(fakeErt);
assert.equal(ert.id,'ert1','active Greek identity must promote to stable canonical id');
assert.equal(ert.originalId,'ert1','canonical promotion must stop persisting imported tvg-id as canonical identity');
assert.equal(ert.name,'ERT1','canonical promotion must use canonical identity name');
assert.equal(ert.logo,'https://i.imgur.com/slE8U5m.png','imported tvg-logo must not override available canonical profile logo');
assert.equal(ert.group,'Γενικά','imported group-title must not override canonical profile category');
assert.equal(ert.groupName,'Γενικά','Registry payload groupName must use canonical profile category');
assert.deepEqual(ert.directUrls,['https://media.example/ert1.m3u8'],'promotion must preserve playback URLs');
assert.equal(ert.metadataTrust,'canonical-profile');

const megaNews=policy.promoteImportedChannel({
  id:'mega-news-feed',originalId:'MEGA NEWS',name:'MEGA News',logo:'https://evil.invalid/mega.png',group:'General',
  directUrls:['https://media.example/meganews.m3u8'],sourceTrust:'temporary',
});
assert.equal(megaNews.id,'meganews','MEGA News must remain distinct from MEGA during promotion');
assert.equal(megaNews.name,'MEGA News');

const unknown=policy.promoteImportedChannel({
  id:'mystery-feed',originalId:'mystery.feed',name:'Mystery TV',logo:'https://untrusted.invalid/logo.png',group:'Premium',
  directUrls:['https://media.example/mystery.m3u8'],sourceTrust:'temporary',
});
assert.equal(unknown.id,'mysteryfeed','unknown imports must retain the project shared normalized local id');
assert.equal(unknown.name,'Mystery TV','unknown imports need a usable display name');
assert.equal(unknown.logo,'','unknown imported logo must not become canonical metadata');
assert.equal(unknown.group,'Other','unknown imported group must not become canonical metadata');
assert.equal(unknown.groupName,'Other');
assert.equal(unknown.metadataTrust,'imported-unprofiled');
assert.deepEqual(unknown.directUrls,['https://media.example/mystery.m3u8'],'unknown imports may still preserve playable sources');

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert.match(main,/import\s*\{\s*promoteImportedChannel\s*\}\s*from\s*['"]\.\/core\/import-promotion-policy\.js['"]/, 'main must import the shared Phase D promotion policy');
assert.match(main,/catalogMode\s*===\s*['"]temporary['"]\s*\?\s*promoteImportedChannel\(selected\)/,'temporary selected channels must cross the policy before My Playlist/source-save APIs receive them');

console.log('Phase D import promotion contract PASS');
