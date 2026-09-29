import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('workers/webtv-registry-entry.js','utf8');

assert.match(source,/setInterval\s*\(/,'pairing page must poll until admin approval');
assert.match(source,/fetch\s*\(\s*FINISH_PATH\s*,\s*\{[\s\S]*method\s*:\s*['\"]POST['\"]/,'pairing page must retry the existing finish endpoint');
assert.match(source,/CURRENT_EDIT_PATH/,'successful auto-finish must continue to the canonical editor');
assert.doesNotMatch(source,/document\.cookie/,'browser JavaScript must never read the HttpOnly pairing secret');
assert.doesNotMatch(source,/localStorage|sessionStorage/,'auto-finish must not copy pairing secrets into browser storage');

console.log('project agent auto-finish regression: PASS');
