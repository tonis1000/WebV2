import assert from 'node:assert/strict';
import fs from 'node:fs';

const managerSource=fs.readFileSync(new URL('../src/playlist-manager.js',import.meta.url),'utf8');
const destinationSource=fs.readFileSync(new URL('../src/xtream-save-destination-ui.js',import.meta.url),'utf8');
const managerOwnsDialog=/xtream-save-destination-dialog[^\n]*contains\(event\.target\)/.test(managerSource);
const dialogStopsOutsidePropagation=/dialog\.addEventListener\(['"]pointerdown['"],\s*(?:event|e)\s*=>\s*(?:event|e)\.stopPropagation\(\)\)/.test(destinationSource);
assert.equal(
  managerOwnsDialog||dialogStopsOutsidePropagation,
  true,
  'Xtream save destination pointer events must stay inside the Playlist Manager ownership boundary so Save does not auto-close the manager',
);
console.log('playlist manager Xtream dialog ownership PASS');
