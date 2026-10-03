import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const path of [
  'src/project-agent-pairing-admin.js',
  'tests/project-agent-auth.test.mjs',
  'tests/project-agent-auto-finish.test.mjs',
  'tests/project-agent-pairing-admin.test.mjs',
  'tests/project-agent-portable-resume.test.mjs',
  'tests/project-agent-put-boundary.test.mjs',
  '.github/workflows/validate-registry-project-agent-boundary.yml',
]) {
  assert.equal(existsSync(path), false, `${path} must remain retired`);
}

const worker=readFileSync('workers/webtv-registry.js','utf8');
const entry=readFileSync('workers/webtv-registry-entry.js','utf8');
const gate=readFileSync('src/admin-gate.js','utf8');

for (const source of [worker,entry,gate]) {
  assert.doesNotMatch(source,/\/api\/project-agent\b/,'project-agent routes must remain retired');
  assert.doesNotMatch(source,/webv2_project_agent/i,'project-agent cookies must remain retired');
  assert.doesNotMatch(source,/ProjectAgentPairing|project-agent-pairing/i,'pairing implementation must remain retired');
}

assert.doesNotMatch(worker,/project_agent_pairings|project_agent_sessions/i,'pairing/session D1 tables must not be recreated');
assert.doesNotMatch(worker,/PROJECT_AGENT_SESSION_DAYS|PROJECT_AGENT_PAIRING_MS/i,'long-lived project-agent session constants must remain retired');

console.log('project-agent pairing/session retirement regression: PASS');
