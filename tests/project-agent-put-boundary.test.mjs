import assert from 'node:assert/strict';

const { default: worker } = await import('../workers/webtv-registry-entry.js?project-agent-put-boundary=1');

const env = {
  ADMIN_TOKEN: 'test-admin-token',
  PIN_AUTH_DISABLED: '1',
};

const request = new Request('https://registry.example/api/project-agent/checkpoints/WEBV2_CURRENT.md', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: '# unauthorized probe\n' }),
});

const response = await worker.fetch(request, env);
assert.equal(response.status, 401, 'unauthorized project-agent PUT must fail closed with 401 even while admin PIN bypass is enabled');
assert.deepEqual(await response.json(), { error: 'Project agent session required' });

console.log('project agent PUT boundary regression: PASS');
