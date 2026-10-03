import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const exists = (name) => fs.existsSync(new URL(name, root));
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const retiredRepoBrainFiles = [
  'WEBV2_PROJECT_BRAIN.md','WEBV2_MANUAL.md','WEBV2_CURRENT.md','WEBV2_ROADMAP.md',
  'WEBV2_ARCHITECTURE.md','WEBV2_PLAYBOOKS.md','WEBV2_TOOLING.md','WEBV2_DECISIONS.md',
  'WEBV2_LESSONS.md','WEBV2_CLEANUP.md'
];
for (const file of retiredRepoBrainFiles) {
  assert.equal(exists(file), false, `${file} must remain retired from GitHub; private Drive is the Project Brain`);
}

const worker=read('workers/webtv-registry.js');
assert.doesNotMatch(worker,/\/api\/project-checkpoints\b/,'Registry Project Brain checkpoint API must remain retired');
assert.doesNotMatch(worker,/project_checkpoint_history|project_checkpoints/i,'Registry worker must not recreate Project Brain tables');

const deploy=read('.github/workflows/deploy-webtv-registry.yml');
assert.match(deploy,/DROP TABLE IF EXISTS project_checkpoint_history/i,'deploy must retire old checkpoint history');
assert.match(deploy,/DROP TABLE IF EXISTS project_checkpoints/i,'deploy must retire old checkpoint table');
assert.doesNotMatch(deploy,/Sync GitHub project checkpoints to D1/i,'GitHub must not repopulate Project Brain into D1');

const readme=read('README.md');
assert.match(readme,/^# WebV2/m,'README remains the public repository documentation surface');

console.log('Drive-canonical Project Brain retirement guard: PASS');
