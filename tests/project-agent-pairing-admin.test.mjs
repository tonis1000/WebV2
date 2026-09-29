import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

assert.equal(existsSync('src/project-agent-pairing-admin.js'), true, 'pairing admin module must exist');
const source=readFileSync('src/project-agent-pairing-admin.js','utf8');
const index=readFileSync('index.html','utf8');
const adminGate=readFileSync('src/admin-gate.js','utf8');

assert.match(source,/webtv:admin-visibility/,'pairing UI should follow admin visibility');
assert.match(source,/WebTVRegistryAuth\.ensureSession/,'pairing approval must reuse existing human admin auth');
assert.match(source,/WebTVRegistryAuth\.token\(\)/,'pairing approval must use the existing trusted admin bearer token');
assert.match(source,/WebTVRegistryAuth\.base\(\)/,'pairing approval must use the configured Registry base URL');
assert.match(source,/\/api\/project-agent\/pair\/approve/,'pairing approval must call the scoped approval endpoint');
assert.doesNotMatch(source,/prompt\s*\(/i,'pairing module must not collect the PIN itself');
assert.doesNotMatch(source,/localStorage|sessionStorage/i,'pairing module must not persist project-agent or admin credentials');
assert.doesNotMatch(source,/ADMIN_TOKEN|ADMIN_PIN/i,'pairing module must not reference server secrets');

const pin=index.indexOf('./src/pin-auth.js');
const gate=index.indexOf('./src/admin-gate.js');
assert.ok(pin>=0&&gate>pin,'admin gate must still load after pin-auth');
assert.match(adminGate,/import\s+['"]\.\/project-agent-pairing-admin\.js\?v=20260929-project-agent['"]/,'admin gate must load pairing module after the existing auth layer');

await import('./project-agent-portable-resume.test.mjs');

console.log('project agent pairing admin regression: PASS');
