import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = readFileSync(path.join(ROOT, 'workers/webtv-registry-entry.js'), 'utf8');

assert.match(entry, /resumeToken/, 'Project-agent browser pairing should expose a one-time resume token');
assert.match(entry, /pairingId/, 'Portable pairing completion must carry the pairing id');
assert.match(entry, /completionSecret/, 'Portable pairing completion must retain the one-time completion secret server contract');
assert.match(entry, /formData\(\)/, 'Finish pairing should accept portable form input when the cookie is unavailable');
assert.match(entry, /temporaryPairing\(request\).*\|\|/s, 'Finish pairing should prefer the cookie but fall back to portable pairing data');

console.log('project-agent portable resume audit: PASS');
