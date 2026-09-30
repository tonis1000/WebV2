import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const frontend = read('.github/workflows/validate-frontend.yml');
const discovery = read('.github/workflows/deploy-source-discovery.yml');
const hunt = read('.github/workflows/deploy-source-hunt.yml');

assert.match(frontend, /src\/\*\*\/\*\.js/,
  'frontend workflow must keep watching all src JavaScript, including shared STRM core');
assert.match(discovery, /src\/core\/strm-core\.js/,
  'Discovery deploy must explicitly watch shared STRM core');
assert.match(hunt, /src\/core\/strm-core\.js/,
  'Hunt deploy must explicitly watch shared STRM core');

assert.match(frontend, /node tests\/strm-core\.test\.mjs/);
assert.match(frontend, /node tests\/strm-resolver-parity\.test\.mjs/);
assert.match(frontend, /node tests\/strm-specific-discovery-provider\.test\.mjs/);
assert.match(frontend, /node tests\/source-discovery-smart-strm-parity\.test\.mjs/);
assert.match(frontend, /node tests\/source-hunt-strm-parity\.test\.mjs/);
assert.match(frontend, /node tests\/strm-duplicate-audit\.test\.mjs/);

assert.match(discovery, /node tests\/strm-core\.test\.mjs/);
assert.match(discovery, /node tests\/strm-specific-discovery-provider\.test\.mjs/);
assert.match(discovery, /node tests\/source-discovery-smart-strm-parity\.test\.mjs/);
assert.match(discovery, /"name":"ERT1"/, 'Discovery live STRM gate must remain ERT1-based');
assert.match(discovery, /strmResolved/, 'Discovery live gate must still require successful STRM resolution');

assert.match(hunt, /node tests\/strm-core\.test\.mjs/);
assert.match(hunt, /node tests\/source-hunt-strm-parity\.test\.mjs/);
assert.match(hunt, /bouquet-proxy/, 'Hunt live Enigma2 bouquet verification must remain intact');

console.log('STRM workflow contract tests PASS');
