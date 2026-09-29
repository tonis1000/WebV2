import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync('.github/workflows/deploy-epg-proxy-gr.yml','utf8');

assert.match(workflow,/\$WORKER_URL\/epg\.xml\?verify=/,'EPG deploy verification must request the real /epg.xml feed');
assert.match(workflow,/--max-time\s+\d+/,'EPG feed verification must have a bounded curl timeout');
assert.match(workflow,/<tv/,'EPG deploy verification must require an XMLTV <tv> root');
assert.match(workflow,/<channel/,'EPG deploy verification must require at least one channel');
assert.match(workflow,/<programme/,'EPG deploy verification must require at least one programme');
assert.doesNotMatch(workflow,/grep -q 'Use \/epg or \/epg\.xml'/,'root banner alone must not prove EPG deployment');

console.log('EPG deploy verification contract verified.');
