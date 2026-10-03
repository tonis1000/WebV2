import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');
const sportHtml=fs.readFileSync(new URL('../sport.html',import.meta.url),'utf8');
const sportJs=fs.readFileSync(new URL('../src/sport-page.js',import.meta.url),'utf8');

assert.match(index,/id="sport-toggle"/,'main viewer must expose a SPORT control');
assert.match(index,/href="\.\/sport\.html"/,'SPORT control must open the dedicated page');
assert.match(rail,/sport-toggle/,'desktop right rail must own SPORT control placement');
assert.doesNotMatch(gate,/html\.admin-locked #sport-toggle/,'SPORT must remain public while admin controls are locked');

assert.match(sportHtml,/id="sport-match-list"/,'SPORT page must expose a match sidebar');
assert.match(sportHtml,/id="sport-frame"/,'SPORT page must expose one iframe viewer');
assert.match(sportHtml,/src="\.\/src\/sport-page\.js/,'SPORT page must load its dedicated presentation module');

assert.match(sportJs,/Europe\/Berlin/,'SPORT display time must be Europe/Berlin');
assert.match(sportJs,/data-link-index/,'SPORT links must carry stable display indexes');
assert.match(sportJs,/classList\.add\('active'\)/,'clicked SPORT link must visibly become active');
assert.match(sportJs,/frame\.src\s*=\s*safeUrl/,'SPORT selection must load only the validated HTTPS page in the iframe');
assert.doesNotMatch(sportJs,/PlayerController|SourceRegistry|WebTVPlaybackAPI/,'SPORT iframe surface must not become a second canonical Player owner');

console.log('sport iframe surface contract ok');


assert.doesNotMatch(sportJs,/makeProviderSection|provider-section/,'SPORT page must use one unified chronological list');
assert.match(sportJs,/sport-archive-toggle/,'SPORT page must expose the SportFM archive filter');
