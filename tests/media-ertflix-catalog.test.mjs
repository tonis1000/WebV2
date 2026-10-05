import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validSeriesId,normalizeCatalog,normalizeDetails,episodeNumber} from '../workers/webtv-media.js';

const worker=fs.readFileSync(new URL('../workers/webtv-media.js',import.meta.url),'utf8');
const media=fs.readFileSync(new URL('../media.html',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../src/media-page.js',import.meta.url),'utf8');

assert.match(worker,/WebTV Media Catalog/,'media worker must have one explicit catalog-owner service identity');
assert.match(worker,/live\.ertflix\.gr/,'ERTFlix adapter must use the official ERTFlix surface');
assert.match(worker,/api\/template\?template=Series%20Guest/,'catalog must use ERTFlix public template JSON');
assert.match(worker,/api\/details\?contentId=/,'series details must use ERTFlix public details JSON');
assert.doesNotMatch(worker,/api\/vod-stream/,'Phase 1 must not adopt ERTFlix playback resolution yet');
assert.doesNotMatch(worker,/fetchHtml|titleNear|seriesFromHtml/,'raw HTML scraping must stay retired');
assert.doesNotMatch(worker,/D1|\.prepare\(|\.put\(|\.delete\(/,'Phase 1 media adapter must remain read-only and persistence-free');
assert.doesNotMatch(worker,/api\.search\.brave|BRAVE_API_KEY/,'media catalog must not use paid Brave search');

assert.equal(validSeriesId('ERT_PS057243_E0'),'ERT_PS057243_E0');
assert.equal(validSeriesId('../bad'),'');
const catalog=normalizeCatalog({rails:[
  {items:[
    {id:'ERT_PS057243_E0',title:'Το Τελευταίο Νησί',year:'2026',category:'Series',rating:'12',image:'/cached-images/a.webp',description:'A'},
    {id:'ERT_PS057243_E0',title:'duplicate'},
    {id:'ERT_PS054542_E0',title:'Η Μεγάλη Χίμαιρα',year:'2025',category:'Series',image:'/cached-images/b.webp'}
  ]}
]});
assert.deepEqual(catalog.map(x=>x.id),['ERT_PS057243_E0','ERT_PS054542_E0']);
assert.equal(catalog[0].image,'https://live.ertflix.gr/cached-images/a.webp');
assert.equal(catalog[0].officialUrl,'https://live.ertflix.gr/details/ERT_PS057243_E0');

const details=normalizeDetails({
  id:'ERT_PS057243_E0',title:'Το Τελευταίο Νησί',year:'2026',category:'Series',description:'Official description',
  episodes:[
    {id:'ERT_PS049821',title:'Ε1 ‧ Η Επέτειος',duration:'44m',streamUrl:'https://example.invalid/ignore.mpd',drmId:'DRM_1'},
    {id:'ERT_PS056147-0013',title:'Ε13 ‧ Οι Αποχαιρετισμοί',duration:'49m',hlsUrl:'https://example.invalid/ignore.m3u8'}
  ]
},'ERT_PS057243_E0');
assert.equal(details.title,'Το Τελευταίο Νησί');
assert.deepEqual(details.episodes.map(x=>x.id),['ERT_PS049821','ERT_PS056147-0013']);
assert.deepEqual(details.episodes.map(x=>x.episodeNumber),[1,13]);
assert.ok(details.episodes.every(x=>!('streamUrl' in x)&&!('hlsUrl' in x)&&!('drmId' in x)));
assert.ok(details.episodes.every(x=>x.officialUrl==='https://live.ertflix.gr/details/ERT_PS057243_E0'));
assert.equal(episodeNumber('E7 ‧ Test'),7);
assert.equal(episodeNumber('Ε24 ‧ Test'),24);

assert.match(media,/id="media-status"/,'media page must expose catalog status');
assert.match(media,/id="media-catalog"/,'media page must expose a catalog surface');
assert.match(media,/id="media-detail"/,'media page must expose a series detail surface');
assert.match(media,/src="\.\/src\/media-page\.js\?v=/,'media page must load its dedicated client');
assert.match(client,/webtv-media\.atonis\.workers\.dev/,'media client must use dedicated media catalog worker');
assert.match(client,/api\/catalog/,'media client must load catalog');
assert.match(client,/api\/series\//,'media client must load exact series details');
assert.doesNotMatch(client,/WebTVPlaybackAPI|WebTVMyPlaylistAPI|WebTVRegistryAuth/,'Phase 1 media browser must not create playback or persistence coupling');

console.log('media ERTFlix JSON catalog contract ok');
