import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const saved=fs.readFileSync(new URL('../src/saved-sources-ui.js',import.meta.url),'utf8');
const health=fs.readFileSync(new URL('../src/source-health-ui.js',import.meta.url),'utf8');

assert.match(
  main,
  /getSnapshot\s*:\s*\(\)\s*=>\s*\(\{\.\.\.diagnosticsState\}\)/,
  'Diagnostics API must expose a read-only structured snapshot'
);
assert.match(
  main,
  /new\s+CustomEvent\(['"]webtv:diagnostics-updated['"]/,
  'main must publish structured diagnostics updates'
);
assert.match(
  main,
  /playbackState\s*:/,
  'diagnostics snapshot must carry playback state'
);
assert.match(
  main,
  /playbackLabel\s*:/,
  'diagnostics snapshot must carry playback label'
);

assert.match(
  saved,
  /addEventListener\(['"]webtv:diagnostics-updated['"]/,
  'Manual Test / Playback Inspector must consume structured diagnostics updates'
);
assert.doesNotMatch(
  saved,
  /new\s+MutationObserver\(inspectDiagnostics\)/,
  'Manual Test verification must not infer success/failure from diagnostic DOM mutations'
);
assert.doesNotMatch(
  saved,
  /new\s+MutationObserver\(syncPlaybackInspector\)/,
  'Playback Inspector must not infer playback state from diagnostic DOM mutations'
);
assert.doesNotMatch(
  saved,
  /diagPlayer\?\.textContent|diagSource\?\.textContent|diagRoute\?\.textContent|diagStartup\?\.textContent|playbackStatus\?\.classList\.contains/,
  'saved-sources UI must not use diagnostic presentation DOM as its state source'
);

assert.match(
  health,
  /addEventListener\(['"]webtv:diagnostics-updated['"]\s*,\s*render\)/,
  'Source Health must refresh from structured diagnostics updates'
);
assert.doesNotMatch(
  health,
  /MutationObserver\(render\)/,
  'Source Health must not watch channel/diagnostic DOM to discover state changes'
);

console.log('Diagnostics structured state ownership PASS');
