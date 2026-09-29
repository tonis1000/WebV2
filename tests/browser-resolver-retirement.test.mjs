import fs from 'node:fs';
import assert from 'node:assert/strict';

const obsoletePaths = [
  'browser-resolver/package.json',
  'browser-resolver/src/index.js',
  'browser-resolver/test.mjs',
  'browser-resolver/wrangler.toml',
  'workers/source-discovery/browser-resolved-official.js',
  'tests/browser-resolved-official-provider.test.mjs',
  '.github/workflows/configure-browser-resolver-link.yml',
  '.github/workflows/deploy-browser-resolver.yml',
  '.github/workflows/diagnose-browser-resolver-ert1.yml',
  '.github/workflows/smoke-browser-resolver-ert1.yml',
  '.github/workflows/smoke-browser-resolver-verify-ert1.yml',
  '.github/workflows/validate-browser-resolver.yml',
];

for (const path of obsoletePaths) {
  assert.equal(fs.existsSync(path), false, `retired Browser Resolver residue still exists: ${path}`);
}

const discovery = fs.readFileSync('workers/webtv-source-discovery.js', 'utf8');
const deploy = fs.readFileSync('.github/workflows/deploy-source-discovery.yml', 'utf8');

assert.doesNotMatch(discovery, /browser-resolved-official/i, 'Source Discovery worker still advertises browser-resolved-official');
assert.doesNotMatch(discovery, /BROWSER_RESOLVER/i, 'Source Discovery worker still depends on Browser Resolver configuration');
assert.doesNotMatch(deploy, /BROWSER_RESOLVER(?:_URL|_TOKEN|_SHARED_TOKEN|\s*=|:)/i, 'Source Discovery deploy workflow still configures Browser Resolver');
assert.doesNotMatch(deploy, /provider\\?['"]?\s*[:=]\s*['"]browser-resolved-official/i, 'Source Discovery deploy workflow still invokes retired provider');
assert.match(deploy, /hasOwnProperty\.call\(s\.providers\|\|\{\},'browser-resolved-official'\)/, 'deploy verification must prove retired provider is absent from live status');

assert.match(discovery, /official-api-resolver/i, 'official-api-resolver must remain active in Source Discovery');
assert.match(deploy, /official-api-resolver/i, 'official-api-resolver live verification must remain in Source Discovery deploy workflow');
assert.equal(fs.existsSync('workers/source-discovery/official-api-resolver.js'), true, 'official-api-resolver implementation must be preserved');
assert.equal(fs.existsSync('tests/official-api-resolver-provider.test.mjs'), true, 'official-api-resolver regression coverage must be preserved');

console.log('Browser Resolver retirement boundary verified.');
