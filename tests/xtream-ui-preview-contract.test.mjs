import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/xtream-ui.js',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/registry-default.js',import.meta.url),'utf8');

assert.match(source,/previewXtreamAccount/,'production Xtream UI must own safe preview');
assert.doesNotMatch(source,/\bsaveXtreamAccount\s*\(/,'Test\/Preview must not call legacy immediate full-account persistence');
assert.match(source,/Test \/ Preview/);
assert.match(source,/xtream-username[^\n]*value\s*=\s*['"]['"]/,'preview attempt must clear username');
assert.match(source,/xtream-password[^\n]*value\s*=\s*['"]['"]/,'preview attempt must clear password');
assert.doesNotMatch(source,/textContent\s*=.*previewToken|innerHTML\s*=.*previewToken/,'opaque preview token must never be rendered');
assert.match(source,/verifyCandidates|verifyWithConcurrency/,'selected preview channel must use the existing verifier client');
assert.match(source,/withVerification/,'verification result must become a policy-compatible candidate');
assert.match(source,/XTREAM_PAGE_SIZE/,'production preview UI must use bounded catalog paging');
assert.doesNotMatch(source,/previewXtreamAccount[\s\S]{0,1200}WebTVPlaylistAPI\?\.applyText|previewXtreamAccount[\s\S]{0,1200}\.applyText\(/,'preview browsing must not populate sidebar/player');
assert.doesNotMatch(registry,/discovery\/discovery-ui\.js/,'legacy Discovery UI must stay out of production entrypoint');
assert.match(registry,/xtream-ui\.js/,'production Xtream UI must remain loaded');
assert.doesNotMatch(registry,/xtream-enhancements\.js/,'legacy Xtream enhancements module must stay out of the production entrypoint');
console.log('Xtream production preview ownership contract PASS');
