import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseM3u } from '../workers/webtv-source-discovery.js';

const mega={id:'mega',originalId:'MEGA',name:'MEGA',tvgId:'mega.gr'};

const base=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-id="MEGA" tvg-name="MEGA",MEGA
#EXTVLCOPT:http-user-agent=WebTV
https://cdn.test/mega/master.m3u8?token=1|User-Agent=UA
#EXTINF:-1 tvg-id="MEGA NEWS" tvg-name="MEGA News",MEGA News
https://cdn.test/meganews/master.m3u8
`,mega,{name:'fixture'});
assert.equal(base.length,1,'MEGA News must not collapse into MEGA');
assert.equal(base[0].sourceUrl,'https://cdn.test/mega/master.m3u8?token=1|User-Agent=UA');
assert.equal(base[0].sourceType,'hls');
assert.equal(base[0].sourceOrigin,'fixture');
assert.equal(base[0].saveEligible,true);

const formats=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-name="MEGA",MEGA
https://cdn.test/live.mpd
#EXTINF:-1 tvg-name="MEGA",MEGA
https://cdn.test/live?id=1
#EXTINF:-1 tvg-name="MEGA",MEGA
rtsp://camera.test/live
#EXTINF:-1 tvg-name="MEGA",MEGA
rtmp://media.test/live
`,mega,{name:'formats'});
assert.deepEqual(formats.map(item=>item.sourceType),['dash','direct','rtsp','rtmp']);
assert.deepEqual(formats.map(item=>item.saveEligible),[true,true,false,false]);

const invalid=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-name="MEGA",MEGA
javascript:alert(1)
`,mega,{name:'invalid'});
assert.equal(invalid.length,0);

const withinLimit=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-name="MEGA",MEGA
#1
#2
#3
#4
#5
#6
#7
#8
https://cdn.test/within.m3u8
`,mega,{name:'within'});
assert.equal(withinLimit.length,1,'source at offset 9 must remain accepted');

const pastLimit=parseM3u(`#EXTM3U
#EXTINF:-1 tvg-name="MEGA",MEGA
#1
#2
#3
#4
#5
#6
#7
#8
#9
https://cdn.test/past.m3u8
`,mega,{name:'past'});
assert.equal(pastLimit.length,0,'source at offset 10 must remain outside the current Discovery scan window');

const many=Array.from({length:14},(_,i)=>`#EXTINF:-1 tvg-name="MEGA",MEGA\nhttps://cdn.test/${i}.m3u8`).join('\n');
const limited=parseM3u(`#EXTM3U\n${many}\n`,mega,{name:'many'});
assert.equal(limited.length,12,'Discovery MAX_RESULTS must remain unchanged');
assert.equal(limited[0].sourceUrl,'https://cdn.test/0.m3u8');
assert.equal(limited[11].sourceUrl,'https://cdn.test/11.m3u8');

const worker=fs.readFileSync(new URL('../workers/webtv-source-discovery.js',import.meta.url),'utf8');
assert.match(worker,/m3u-container\.js/,'Source Discovery must import the shared M3U container core');
assert.match(worker,/parseM3uContainer/,'Source Discovery must consume parseM3uContainer');
assert.match(worker,/function\s+parseEnigma2\s*\(/,'E2 must leave Enigma2 parsing local and unchanged');
assert.doesNotMatch(worker,/function\s+parseM3u\([^)]*\)\s*\{\s*const lines=/,'Source Discovery must not retain independent M3U line traversal');

console.log('Source Discovery M3U parity PASS');
