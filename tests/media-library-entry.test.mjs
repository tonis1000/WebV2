import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const rail=fs.readFileSync(new URL('../src/right-rail-preview.js',import.meta.url),'utf8');
const gateCss=fs.readFileSync(new URL('../admin-gate.css',import.meta.url),'utf8');
const media=fs.readFileSync(new URL('../media.html',import.meta.url),'utf8');

assert.match(index,/id="media-toggle"/,'main page must expose one Media Library entry');
assert.match(index,/href="\.\/media\.html"/,'Media Library entry must open the separate media page');
assert.match(rail,/media-toggle/,'desktop right rail must move the Media Library entry into Tools');
assert.match(gateCss,/html\.admin-locked #media-toggle/,'Media Library entry must stay behind the protected admin rail');

assert.match(media,/<h1>MEDIA<\/h1>/,'media page must have its own MEDIA product identity');
assert.match(media,/Σειρές/,'media page must expose the series area');
assert.match(media,/Ταινίες/,'media page must expose the movies area');
assert.match(media,/Ελληνικ(?:ούς|οι) υπότιτλ/,'media page must preserve the Greek-subtitle direction');
assert.match(media,/FOUND_TITLE[^<]*→[^<]*PLAYBACK_CONFIRMED/,'media page must state the media verification boundary');
assert.doesNotMatch(media,/Find channels & sources/,'Media Library must remain separate from live channel discovery');

console.log('media library entry contract ok');
