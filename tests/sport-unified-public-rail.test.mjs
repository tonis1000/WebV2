import assert from 'node:assert/strict';
import fs from 'node:fs';

const sportJs=fs.readFileSync(new URL('../src/sport-page.js',import.meta.url),'utf8');
const sportHtml=fs.readFileSync(new URL('../sport.html',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gateCss=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(sportHtml,/id="sport-archive-toggle"/,'SPORT page must expose a SportFM archive filter');
assert.match(sportJs,/PRE_START_MINUTES\s*=\s*10/,'green window must begin 10 minutes before start');
assert.match(sportJs,/POST_END_MINUTES\s*=\s*15/,'green window must remain through end +15 minutes');
assert.match(sportJs,/sort\([^)]*startUtc|sortEventsByStart/,'SPORT events must be chronologically sorted');
assert.doesNotMatch(sportJs,/makeProviderSection\(/,'SPORT sidebar must be one unified list, not provider sections');
assert.match(sportJs,/archiveEvents/,'SPORT page must consume SportFM archive events');
assert.match(sportJs,/sportfmtv/,'SPORT rows must retain provider identity');

assert.match(gateCss,/html\.admin-locked #sport-toggle,/,'SPORT entry must stay inside the protected rail');
assert.match(index,/right-rail-preview\.js/,'main page must load the desktop/public rail explicitly');
assert.match(rail,/html\.rail-preview\.admin-locked \.desktop-control-rail\{display:none!important\}/,'right rail must be hidden before explicit PIN unlock');
assert.match(rail,/admin-locked[^\n]*#desktop-rail-tools|#desktop-rail-tools/,'locked right rail must keep the public tools area available');

assert.match(main,/loadStartupCloudPlaylist\(\)/,'fresh/return entry must use the resilient startup playlist path');
assert.match(main,/preserveSelection:false/,'fresh/return entry must start with no selected channel');
assert.match(main,/epg\.refresh\(\{channels\}\)/,'EPG must refresh for the whole sidebar without selecting a channel');

console.log('SPORT unified/public rail contract ok');
