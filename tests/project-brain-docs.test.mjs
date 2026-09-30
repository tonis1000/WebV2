import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const exists = (name) => fs.existsSync(new URL(name, root));

const required = [
  'WEBV2_PROJECT_BRAIN.md','WEBV2_MANUAL.md','WEBV2_CURRENT.md','WEBV2_ROADMAP.md',
  'WEBV2_ARCHITECTURE.md','WEBV2_PLAYBOOKS.md','WEBV2_TOOLING.md','WEBV2_DECISIONS.md',
  'WEBV2_LESSONS.md','WEBV2_CLEANUP.md'
];

for (const file of required) assert.equal(exists(file), true, `${file} must exist`);

const index = read('WEBV2_PROJECT_BRAIN.md');
for (const file of required.filter((x) => x !== 'WEBV2_PROJECT_BRAIN.md')) {
  assert.equal(index.includes(file), true, `Brain index must reference ${file}`);
}

const manual = read('WEBV2_MANUAL.md');
for (const phrase of [
  'Problem-to-Knowledge',
  'implemented + deployed + actually verified',
  '/api/project-status',
  'WEBV2_CURRENT.md',
  'reconciliation mode'
]) assert.equal(manual.includes(phrase), true, `Manual missing ${phrase}`);
assert.match(manual, /GitHub[^\n]*WEBV2_CURRENT\.md|WEBV2_CURRENT\.md[^\n]*GitHub/i, 'Manual must identify GitHub CURRENT ownership');
assert.match(manual, /mirror|history|fallback/i, 'Manual must classify Registry/D1 CURRENT as non-canonical mirror/history/fallback');

const current = read('WEBV2_CURRENT.md');
assert.match(current, /# WEBV2 CURRENT STATE/i);
assert.match(current, /canonical[^\n]*GitHub|GitHub[^\n]*canonical/i, 'Repo CURRENT must declare GitHub canonical ownership');
assert.match(current, /CURRENT VERSION/i, 'Repo CURRENT must contain current version state');
assert.match(current, /CURRENT TASK/i, 'Repo CURRENT must contain current task state');
assert.match(current, /NEXT SAFE ACTION/i, 'Repo CURRENT must contain next safe action');
assert.match(current, /mirror|history|fallback/i, 'Repo CURRENT must record Registry/D1 mirror status');
assert.doesNotMatch(current, /This repository file is \*\*not canonical current-state content\*\*|pointer only|pointer-only/i, 'Repo CURRENT must no longer use the old pointer-only contract');
assert.match(current, /[a-f0-9]{40}/i, 'Repo CURRENT must contain exact verified commit evidence');

const roadmap = read('WEBV2_ROADMAP.md');
for (const phrase of ['Phase E1','Phase E2','M3U','STRM','Enigma2','final repo cleanup']) {
  assert.equal(roadmap.toLowerCase().includes(phrase.toLowerCase()), true, `Roadmap missing ${phrase}`);
}

const architecture = read('WEBV2_ARCHITECTURE.md');
for (const phrase of ['Registry / D1','Channel Identity','Channel Profile','Source Format Registry','Source Hunt','Source Discovery','Source Verifier','Player']) {
  assert.equal(architecture.includes(phrase), true, `Architecture missing ${phrase}`);
}
assert.match(architecture, /GitHub[^\n]*current|current[^\n]*GitHub/i, 'Architecture must assign canonical current-state ownership to GitHub');

const playbooks = read('WEBV2_PLAYBOOKS.md');
for (const phrase of ['CAS','readback','RED','GREEN','live verification']) {
  assert.equal(playbooks.includes(phrase), true, `Playbooks missing ${phrase}`);
}
assert.match(playbooks, /GitHub[^\n]*CURRENT|CURRENT[^\n]*GitHub/i, 'Playbooks must read/write canonical CURRENT through GitHub');
assert.match(playbooks, /mirror|history|fallback/i, 'Playbooks must keep D1 CURRENT as mirror/history/fallback');

const tooling = read('WEBV2_TOOLING.md');
for (const phrase of ['TinyFish Search','TinyFish Fetch','TinyFish Browser','TinyFish Agent','re-check']) {
  assert.equal(tooling.includes(phrase), true, `Tooling missing ${phrase}`);
}

const decisions = read('WEBV2_DECISIONS.md');
for (const phrase of ['D1-primary My Playlist','Browser Resolver','WebV2 channel id','generic HTTP','DONE']) {
  assert.equal(decisions.includes(phrase), true, `Decisions missing ${phrase}`);
}
assert.match(decisions, /GitHub[^\n]*WEBV2_CURRENT\.md[^\n]*canonical|canonical[^\n]*GitHub[^\n]*WEBV2_CURRENT\.md/i, 'Decisions must record GitHub CURRENT as canonical');

const lessons = read('WEBV2_LESSONS.md');
for (const phrase of ['workers.dev','auth failure','CAS','exact-SHA']) {
  assert.equal(lessons.includes(phrase), true, `Lessons missing ${phrase}`);
}

const cleanup = read('WEBV2_CLEANUP.md');
for (const phrase of ['Current consumers','Replacement','Required proof','Status']) {
  assert.equal(cleanup.includes(phrase), true, `Cleanup missing ${phrase}`);
}

for (const [name, text] of [
  ['Manual', manual],
  ['Architecture', architecture],
  ['Playbooks', playbooks],
  ['Decisions', decisions],
  ['Project Brain index', index],
]) {
  assert.doesNotMatch(text, /Current verified truth:\s*(?:live\s+)?Registry\/D1|Registry\/D1[^\n]*canonical current/i, `${name} must not retain Registry/D1 canonical CURRENT ownership`);
}

console.log('Project Brain documentation contract: PASS');
