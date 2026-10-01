import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker=fs.readFileSync('workers/webtv-xtream-mock.js','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy-webtv-xtream-mock.yml','utf8');

assert.match(worker,/const VERSION\s*=\s*'1\.2'/,'Xtream Mock implementation must be v1.2 for scalable fixtures');
assert.match(worker,/test_user/,'legacy test_user fixture must remain');
assert.match(worker,/test_50/,'50-channel fixture must exist');
assert.match(worker,/test_500/,'500-channel fixture must exist');
assert.match(worker,/test_5000/,'5,000-channel fixture must exist');
assert.match(worker,/stream_id:\s*1101/,'legacy MEGA stream must remain present');

assert.match(workflow,/j\.version==='1\.2'/,'deploy verification must require live Xtream Mock v1.2');
assert.match(workflow,/j\.channels===4/,'status verification must preserve legacy 4-channel fixture');
assert.match(workflow,/username=test_5000&password=test_pass&action=get_live_streams/,'deploy verification must fetch the large deterministic fixture');
assert.match(workflow,/large\.length!==5000/,'deploy verification must require exactly 5,000 generated streams');
assert.match(workflow,/Verified Xtream mock login \+ legacy 4 streams \+ large 5000 streams/,'deploy success message must describe both compatibility and scale checks');
assert.doesNotMatch(workflow,/j\.version==='1\.1'/,'stale v1.1 verification must be removed');

console.log('Xtream Mock deploy contract verified.');
