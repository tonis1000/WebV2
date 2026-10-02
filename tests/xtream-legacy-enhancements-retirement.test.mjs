import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const registry=read('src/registry-default.js');

assert.doesNotMatch(registry,/xtream-enhancements\.js/,'legacy Xtream enhancements module must not load in production');
assert.equal(fs.existsSync(path.join(ROOT,'src/xtream-enhancements.js')),false,'legacy Xtream enhancements module must be deleted after ownership migration');

const srcDir=path.join(ROOT,'src');
const files=[];
const walk=dir=>{for(const name of fs.readdirSync(dir)){const full=path.join(dir,name);const stat=fs.statSync(full);if(stat.isDirectory())walk(full);else if(full.endsWith('.js'))files.push(full);}};
walk(srcDir);
const production=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');

assert.equal(production.includes('Save Xtream Playlist'),false,'legacy full-account Save Xtream Playlist path must be retired');
assert.equal(production.includes('xtream-merge-overlay'),false,'legacy Xtream to My Playlist merge dialog must be retired');
assert.equal(/#my-playlist-channel-action[\s\S]{0,500}isXtreamChannel/.test(production),false,'Xtream-specific capture interception of My Playlist action must be retired');

const xtreamUi=read('src/xtream-ui.js');
const destination=read('src/xtream-save-destination-ui.js');
const fullUi=read('src/xtream-full-account-ui.js');
assert.match(xtreamUi,/webtv:xtream-preview-save-channel-request/,'canonical Save Channel request must remain');
assert.match(xtreamUi,/webtv:xtream-preview-save-account-request/,'canonical Full Account request must remain');
assert.match(xtreamUi,/Save Channel…/,'canonical Save Channel UI must remain');
assert.match(xtreamUi,/Save Full Xtream Account/,'canonical Full Account UI must remain');
assert.match(destination,/saveVerifiedXtreamChannel/,'canonical verified channel persistence must remain');
assert.match(fullUi,/saveVerifiedFullXtreamAccount/,'canonical verified full-account persistence must remain');

console.log('Xtream legacy enhancements retirement PASS');
