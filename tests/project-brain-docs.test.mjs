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
  '/api/project-agent/checkpoints',
  '/api/project-agent/checkpoints/WEBV2_CURRENT.md',
  'reconciliation mode'
]) assert.equal(manual.includes(phrase), true, `Manual missing ${phrase}`);

const currentPointer = read('WEBV2_CURRENT.md');
assert.match(currentPointer, /Registry|D1/);
assert.match(currentPointer, /not canonical|pointer/i);
assert.equal(currentPointer.includes('/api/project-agent/checkpoints/WEBV2_CURRENT.md'), true, 'Repo CURRENT pointer must use scoped project-agent checkpoint read path');
assert.equal(/[a-f0-9]{40}/i.test(currentPointer), false, 'Repo CURRENT pointer must not copy a production SHA');

const roadmap = read('WEBV2_ROADMAP.md');
for (const phrase of ['Phase E1','Phase E2','M3U','STRM','Enigma2','final repo cleanup']) {
  assert.equal(roadmap.toLowerCase().includes(phrase.toLowerCase()), true, `Roadmap missing ${phrase}`);
}

const architecture = read('WEBV2_ARCHITECTURE.md');
for (const phrase of ['Registry / D1','Channel Identity','Channel Profile','Source Format Registry','Source Hunt','Source Discovery','Source Verifier','Player']) {
  assert.equal(architecture.includes(phrase), true, `Architecture missing ${phrase}`);
}

const playbooks = read('WEBV2_PLAYBOOKS.md');
for (const phrase of ['CAS','readback','RED','GREEN','live verification','/api/project-agent/checkpoints']) {
  assert.equal(playbooks.includes(phrase), true, `Playbooks missing ${phrase}`);
}

const tooling = read('WEBV2_TOOLING.md');
for (const phrase of ['TinyFish Search','TinyFish Fetch','TinyFish Browser','TinyFish Agent','re-check']) {
  assert.equal(tooling.includes(phrase), true, `Tooling missing ${phrase}`);
}

const decisions = read('WEBV2_DECISIONS.md');
for (const phrase of ['D1-primary My Playlist','Browser Resolver','WebV2 channel id','generic HTTP','DONE']) {
  assert.equal(decisions.includes(phrase), true, `Decisions missing ${phrase}`);
}

const lessons = read('WEBV2_LESSONS.md');
for (const phrase of ['workers.dev','auth failure','CAS','exact-SHA']) {
  assert.equal(lessons.includes(phrase), true, `Lessons missing ${phrase}`);
}

const cleanup = read('WEBV2_CLEANUP.md');
for (const phrase of ['Current consumers','Replacement','Required proof','Status']) {
  assert.equal(cleanup.includes(phrase), true, `Cleanup missing ${phrase}`);
}

console.log('Project Brain documentation contract: PASS');
