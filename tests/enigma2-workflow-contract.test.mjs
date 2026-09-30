import assert from 'node:assert/strict';
import fs from 'node:fs';

const discovery=fs.readFileSync(new URL('../.github/workflows/deploy-source-discovery.yml',import.meta.url),'utf8');
const ownership=fs.readFileSync(new URL('../.github/workflows/validate-enigma2.yml',import.meta.url),'utf8');

for(const required of [
  "src/core/enigma2-core.js",
  "tests/enigma2-core.test.mjs",
  "tests/source-discovery-enigma2-parity.test.mjs",
])assert.ok(discovery.includes(required),`Discovery deploy must depend on ${required}`);
assert.match(discovery,/node --check src\/core\/enigma2-core\.js/,'Discovery deploy validates shared Enigma2 core syntax');
assert.match(discovery,/node tests\/enigma2-core\.test\.mjs/,'Discovery deploy executes shared Enigma2 core contract');
assert.match(discovery,/node tests\/source-discovery-enigma2-parity\.test\.mjs/,'Discovery deploy executes Enigma2 caller parity');

for(const required of [
  "index.html",
  "src/core/enigma2-core.js",
  "src/source-hunt-enigma2.js",
  "tests/enigma2-core.test.mjs",
  "tests/enigma2-proxy-boundary.test.mjs",
  "tests/enigma2-duplicate-audit.test.mjs",
  "tests/source-discovery-enigma2-parity.test.mjs",
  "tests/source-hunt-enigma2-parity.test.mjs",
])assert.ok(ownership.includes(required),`durable Enigma2 validation must own ${required}`);

assert.doesNotMatch(ownership,/e3b-enigma2-red/,'durable workflow must not depend on temporary RED scaffolding');

console.log('Enigma2 workflow wiring contract PASS');
