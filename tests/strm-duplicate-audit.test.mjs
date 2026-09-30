import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(full);
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'workers'));

const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
const sources = new Map(jsFiles.map(file => [rel(file), fs.readFileSync(file, 'utf8')]));

const kodiOwners = [...sources.entries()]
  .filter(([, source]) => source.includes('#KODIPROP:'))
  .map(([file]) => file);
assert.deepEqual(kodiOwners, ['src/core/strm-core.js'],
  'only the shared STRM core may own KODIPROP document parsing');

for (const [file, source] of sources) {
  if (file === 'src/core/strm-core.js') continue;
  assert.doesNotMatch(source, /function\s+(?:parseStrmText|parseStrmDocument|isStrm)\s*\(/,
    `${file} must not declare an independent STRM structural parser`);
}

for (const file of [
  'src/core/strm-resolver.js',
  'workers/source-discovery/strm-specific-discovery.js',
  'workers/source-huntatonisworkersdev.js',
]) {
  assert.match(sources.get(file) || '', /strm-core\.js/,
    `${file} must consume the shared STRM core`);
}

assert.match(sources.get('src/core/source-registry.js') || '', /strm-resolver\.js/,
  'SourceRegistry remains a resolver consumer, not a STRM parser owner');

console.log('STRM duplicate parser audit PASS');
