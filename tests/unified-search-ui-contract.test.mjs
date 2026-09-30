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
  'Copy report','Export JSON','Open source','Details','Play',
])assert.ok(js.includes(required),`UI must include ${required}`);

assert.equal(/Find Official|Official Sources|official-provider-lane|official-api-resolver/i.test(js),false,'Official discovery controls must not appear in Unified Search UI');
assert.ok(js.includes("target='_blank'")||js.includes('target="_blank"')||js.includes("link.target='_blank'"),'source links must open in a new tab');
assert.ok(/noopener/.test(js)&&/noreferrer/.test(js),'source links must use noopener/noreferrer');
assert.ok(/WebTVPlaybackAPI/.test(js)&&/testCandidate/.test(js),'explicit Play action must use the existing playback boundary');
assert.ok(/groupCandidatesByChannel/.test(js),'results must render grouped by channel');
assert.ok(/buildSearchContext/.test(js),'search intent must use the group-aware context');
assert.ok(js.includes('reporter?.exportText?.()')||js.includes('reporter.exportText()'),'Copy report must use redacted reporter export');
assert.ok(js.includes('reporter?.exportJson?.()')||js.includes('reporter.exportJson()'),'JSON export must use redacted reporter export');

for(const requiredClass of ['.unified-search-panel','.unified-search-grid','.unified-channel-card','.unified-candidate-row','.unified-report'])assert.ok(css.includes(requiredClass),`stylesheet must define ${requiredClass}`);
assert.ok(/@media/.test(css),'Unified Search must include responsive layout rules');
assert.equal(/<style|style\.textContent/.test(js),false,'search visual styling belongs in unified-search.css, not injected style blobs');

console.log('polished unified search UI contract PASS');
