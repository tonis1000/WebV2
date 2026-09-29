import assert from 'node:assert/strict';

const registryModule = await import('../workers/webtv-registry.js?checkpoint-write-api-test=1');
const worker = registryModule.default;

function createFakeD1() {
  const checkpoints = new Map();
  const history = [];

  const statement = (sql, args = []) => ({
    bind(...nextArgs) { return statement(sql, nextArgs); },
    async first() {
      if (/SELECT content,\s*byte_length,\s*sha256,\s*updated_at FROM project_checkpoints WHERE name=\?/i.test(sql)) {
        const row = checkpoints.get(args[0]);
        return row ? { ...row } : null;
      }
      if (/SELECT content,\s*sha256,\s*updated_at FROM project_checkpoints WHERE name=\?/i.test(sql)) {
        const row = checkpoints.get(args[0]);
        return row ? { content: row.content, sha256: row.sha256, updated_at: row.updated_at } : null;
      }
      throw new Error(`Unexpected first() SQL: ${sql}`);
    },
    async all() {
      if (/FROM project_checkpoint_history WHERE name=\?/i.test(sql)) {
        const name = args[0];
        return {
          results: history
            .filter(row => row.name === name)
            .slice()
            .reverse()
            .map(({ content, ...meta }) => ({ ...meta })),
        };
      }
      throw new Error(`Unexpected all() SQL: ${sql}`);
    },
    async run() {
      if (/^CREATE TABLE IF NOT EXISTS project_checkpoints/i.test(sql)) return { success: true };
      if (/^CREATE TABLE IF NOT EXISTS project_checkpoint_history/i.test(sql)) return { success: true };
      if (/^INSERT INTO project_checkpoint_history/i.test(sql)) {
        history.push({
          id: history.length + 1,
          name: args[0],
          content: args[1],
          byte_length: args[2],
          sha256: args[3],
          checkpoint_updated_at: args[4],
          archived_at: '2026-09-29T12:00:00.000Z',
        });
        return { success: true };
      }
      if (/^INSERT INTO project_checkpoints/i.test(sql)) {
        const [name, content, byteLength, sha256] = args;
        checkpoints.set(name, {
          content,
          byte_length: byteLength,
          sha256,
          updated_at: '2026-09-29T12:00:01.000Z',
        });
        return { success: true };
      }
      throw new Error(`Unexpected run() SQL: ${sql}`);
    },
  });

  return {
    prepare(sql) { return statement(String(sql)); },
    checkpoints,
    history,
  };
}

const DB = createFakeD1();
const env = {
  DB,
  ADMIN_TOKEN: 'checkpoint-test-admin-token',
  ADMIN_PIN: '123456',
};
const base = 'https://registry.example/api/project-checkpoints/WEBV2_CURRENT.md';
const auth = { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'application/json' };

async function request(method, url = base, body, headers = auth) {
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return worker.fetch(new Request(url, init), env);
}

// Unauthorized project-state mutation must remain locked.
{
  const response = await request('PUT', base, { content: '# private' }, { 'content-type': 'application/json' });
  assert.equal(response.status, 401, 'checkpoint writes must require Registry admin authentication');
}

// Create the canonical checkpoint when it does not exist yet.
let firstSha = '';
{
  const response = await request('PUT', base, { content: '# WEBV2 CURRENT\n\nInitial private state.\n' });
  assert.equal(response.status, 201, 'first checkpoint write should create the canonical row');
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(json.checkpoint.name, 'WEBV2_CURRENT.md');
  assert.equal(json.checkpoint.created, true);
  assert.equal(json.checkpoint.historyCreated, false);
  assert.match(json.checkpoint.sha256, /^[a-f0-9]{64}$/);
  firstSha = json.checkpoint.sha256;
}

// GET must expose the current SHA without wrapping the Markdown in JSON.
{
  const response = await request('GET');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-checkpoint-sha256'), firstSha);
  assert.equal(await response.text(), '# WEBV2 CURRENT\n\nInitial private state.\n');
}

// Existing checkpoints require optimistic concurrency protection.
{
  const response = await request('PUT', base, { content: '# changed without precondition\n' });
  assert.equal(response.status, 428, 'updates without expectedSha256 must be rejected');
}
{
  const response = await request('PUT', base, { content: '# stale writer\n', expectedSha256: '0'.repeat(64) });
  assert.equal(response.status, 409, 'stale checkpoint writers must not overwrite newer state');
  const json = await response.json();
  assert.equal(json.error, 'Checkpoint changed since it was read');
  assert.equal(json.currentSha256, firstSha);
}

// A matching SHA updates current state and snapshots the previous version.
let secondSha = '';
{
  const response = await request('PUT', base, {
    content: '# WEBV2 CURRENT\n\nUpdated verified state.\n',
    expectedSha256: firstSha,
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.checkpoint.created, false);
  assert.equal(json.checkpoint.historyCreated, true);
  assert.equal(json.checkpoint.previousSha256, firstSha);
  secondSha = json.checkpoint.sha256;
  assert.notEqual(secondSha, firstSha);
  assert.equal(DB.history.length, 1, 'previous canonical content must be archived exactly once');
}

// Rewriting identical content is an idempotent no-op and must not grow history.
{
  const response = await request('PUT', base, {
    content: '# WEBV2 CURRENT\n\nUpdated verified state.\n',
    expectedSha256: secondSha,
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.checkpoint.unchanged, true);
  assert.equal(json.checkpoint.historyCreated, false);
  assert.equal(DB.history.length, 1);
}

// History is private, metadata-only, and tied to the checkpoint name.
{
  const response = await request('GET', `${base}/history`);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.name, 'WEBV2_CURRENT.md');
  assert.equal(json.history.length, 1);
  assert.equal(json.history[0].sha256, firstSha);
  assert.equal(Object.prototype.hasOwnProperty.call(json.history[0], 'content'), false, 'history listing should not dump Markdown bodies');
}

// Keep checkpoint names deliberately narrow and Markdown-only.
{
  const bad = await request('PUT', 'https://registry.example/api/project-checkpoints/not-private.txt', { content: 'x' });
  assert.equal(bad.status, 400);
}

console.log('project checkpoint write API regression: PASS');
