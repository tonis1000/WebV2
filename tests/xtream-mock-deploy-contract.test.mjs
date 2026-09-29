import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker=fs.readFileSync('workers/webtv-xtream-mock.js','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy-webtv-xtream-mock.yml','utf8');

assert.match(worker,/const VERSION\s*=\s*'1\.1'/,'Xtream Mock implementation must stay at v1.1');
assert.match(worker,/channels:\s*streams\.length/,'Xtream Mock status must report the real stream count');
assert.match(worker,/category_id:\s*'40'/,'Xtream Mock v1.1 Greece category must remain present');
assert.match(worker,/stream_id:\s*1101/,'Xtream Mock v1.1 fourth stream must remain present');

assert.match(workflow,/j\.version==='1\.1'/,'deploy verification must require live Xtream Mock v1.1');
assert.match(workflow,/j\.channels===4/,'deploy verification must require 4 live channels');
assert.match(workflow,/cats\.length!==4/,'deploy verification must require 4 categories');
assert.match(workflow,/streams\.length!==4/,'deploy verification must require 4 streams');
assert.match(workflow,/Verified Xtream mock login \+ 4 categories \+ 4 streams/,'deploy success message must describe the v1.1 contract');
assert.doesNotMatch(workflow,/j\.version==='1\.0'/,'stale v1.0 verification must be removed');
assert.doesNotMatch(workflow,/j\.channels===3/,'stale 3-channel verification must be removed');

console.log('Xtream Mock deploy contract verified.');
