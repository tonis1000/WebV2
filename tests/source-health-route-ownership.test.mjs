import assert from 'node:assert/strict';
import fs from 'node:fs';

const healthUi=fs.readFileSync(new URL('../src/source-health-ui.js',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/core/source-registry.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\bparseIptvUrl\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not parse IPTV routes independently'
);
assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\bworkerUrl\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not build worker routes independently'
);
assert.doesNotMatch(
  healthUi,
  /import\s*\{[^}]*\b(isHls|isDash)\b[^}]*\}\s*from\s*['"]\.\/core\/utils\.js/,
  'Source Health must not classify playable media independently'
);
assert.doesNotMatch(
  healthUi,
  /new\s+StrmResolver\s*\(/,
  'Source Health must not own a second STRM resolver'
);
assert.doesNotMatch(
  healthUi,
  /async\s+function\s+routeRows\s*\(/,
  'Source Health must not own a second route reconstruction function'
);

assert.match(
  registry,
  /async\s+getCuratedRouteDiagnostics\s*\(channel\)/,
  'SourceRegistry must expose canonical curated route diagnostics'
);
assert.match(
  main,
  /getSourceHealthRows\s*:\s*channel\s*=>\s*sources\.getCuratedRouteDiagnostics\(channel\)/,
  'Diagnostics API must delegate Source Health rows to the active SourceRegistry instance'
);
assert.match(
  healthUi,
  /WebTVDiagnosticsAPI\?\.getSourceHealthRows/,
  'Source Health must consume canonical diagnostic rows'
);

console.log('Source Health route ownership PASS');
