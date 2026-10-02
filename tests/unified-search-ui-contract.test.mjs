import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsPath=new URL('../src/search/search-ui.js',import.meta.url);
const cssPath=new URL('../unified-search.css',import.meta.url);
assert.equal(fs.existsSync(jsPath),true,'unified search UI module must exist');
assert.equal(fs.existsSync(cssPath),true,'unified search stylesheet must exist');

const js=fs.readFileSync(jsPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');

for(const required of [
  'unified-search-form','unified-search-query','unified-search-results','unified-search-report',
  'unified-search-report-summary','unified-search-report-timeline','unified-search-cancel',
  'Copy report','Export JSON','Open source','Details','Play','unified-search-status-banner','unified-search-submit',
])assert.ok(js.includes(required),`UI must include ${required}`);

assert.equal(/Find Official|Official Sources|official-provider-lane|official-api-resolver/i.test(js),false,'Official discovery controls must not appear in Unified Search UI');
assert.ok(js.includes("target='_blank'")||js.includes('target="_blank"')||js.includes("link.target='_blank'"),'source links must open in a new tab');
assert.ok(/noopener/.test(js)&&/noreferrer/.test(js),'source links must use noopener/noreferrer');
assert.ok(/safePublicActionUrl/.test(js),'all public source/copy actions must use the canonical safe URL exposure policy');
assert.equal(/writeText\?\.\(raw\.sourceUrl\)|writeText\(raw\.sourceUrl\)/.test(js),false,'UI must never copy a raw candidate URL directly');
assert.ok(/WebTVPlaybackAPI/.test(js)&&/testCandidate/.test(js),'explicit Play action must use the existing playback boundary');
assert.ok(/groupCandidatesByChannel/.test(js),'results must render grouped by channel');
assert.ok(/snapshot\.leads|renderLeads/.test(js),'exploration leads must remain visible after legacy Hunt UI retirement');
assert.ok(/activeRun\s*!==\s*run|run\s*!==\s*activeRun/.test(js),'superseded search completion must not overwrite the active run UI');
assert.ok(/buildSearchContext/.test(js),'search intent must use the group-aware context');
assert.ok(/verifySearchCandidates/.test(js),'UI must use the canonical Unified Search verifier bridge');
assert.ok(/verifyBatch\s*:\s*verifySearchCandidates/.test(js),'UI must pass progressive verification into the search orchestrator');
assert.ok(/UnifiedNowPlayingState/.test(js),'UI must use independent Now Playing state');
assert.ok(/setCandidate\(/.test(js),'successful candidate playback must own the Now Playing label');
assert.ok(/sidebarChanged\(/.test(js),'explicit sidebar changes must clear candidate playback ownership');
assert.ok(/syncSearchQueryToSidebarSelection/.test(js),'sidebar channel changes must synchronize the Unified Search query');
assert.ok(/unified-search-query/.test(js)&&/\.value\s*=/.test(js),'sidebar synchronization must write the selected channel into the Search field');
assert.equal(/unified-search-query[^\n]*addEventListener\(['"]input['"][^\n]*syncSearchQueryToSidebarSelection/.test(js),false,'manual Search typing must remain free and must not be overwritten by an input listener');
assert.ok(js.includes('reporter?.exportText?.()')||js.includes('reporter.exportText()'),'Copy report must use redacted reporter export');
assert.ok(js.includes('reporter?.exportJson?.()')||js.includes('reporter.exportJson()'),'JSON export must use redacted reporter export');

for(const requiredClass of ['.unified-search-panel','.unified-search-grid','.unified-channel-card','.unified-candidate-row','.unified-report'])assert.ok(css.includes(requiredClass),`stylesheet must define ${requiredClass}`);
assert.ok(/@media/.test(css),'Unified Search must include responsive layout rules');
assert.ok(/Searching…/.test(js),'running state must expose an obvious Searching label');
assert.ok(/Finished/.test(js),'completed state must expose an obvious Finished label');
assert.ok(/unified-search-status-banner/.test(css),'stylesheet must define a prominent search status banner');
assert.ok(/unified-search-spinner/.test(css),'stylesheet must define a visible searching spinner');
assert.ok(/disabled\s*=\s*status\s*===\s*['"]running['"]/.test(js)||/submit\.disabled\s*=\s*running/.test(js),'Search submit must be disabled while a search is running');
assert.ok(/Lanes:\s*\$\{done\}\/\$\{lanes\.length\}/.test(js),'visible status must report lane completion progress');
assert.equal(/<style|style\.textContent/.test(js),false,'search visual styling belongs in unified-search.css, not injected style blobs');

console.log('polished unified search UI contract PASS');
