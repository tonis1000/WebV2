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
const frontendClient = fs.readFileSync('src/discovery/external-discovery-client.js', 'utf8');

assert.doesNotMatch(discovery, /browser-resolved-official/i, 'Source Discovery worker still advertises browser-resolved-official');
assert.doesNotMatch(discovery, /BROWSER_RESOLVER/i, 'Source Discovery worker still depends on Browser Resolver configuration');
assert.doesNotMatch(deploy, /BROWSER_RESOLVER(?:_URL|_TOKEN|_SHARED_TOKEN|\s*=|:)/i, 'Source Discovery deploy workflow still configures Browser Resolver');
assert.doesNotMatch(deploy, /provider\?['"]?\s*[:=]\s*['"]browser-resolved-official/i, 'Source Discovery deploy workflow still invokes retired provider');
assert.match(deploy, /hasOwnProperty\.call\(s\.providers\|\|\{\},'browser-resolved-official'\)/, 'deploy verification must prove retired provider is absent from live status');
assert.doesNotMatch(frontendClient, /browser-resolved-official/i, 'frontend discovery client still references retired browser-resolved-official provider');

console.log('Browser Resolver retirement boundary verified.');
