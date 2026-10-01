import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runUnifiedSearch } from '../src/search/search-orchestrator.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.includes('src/search/search-ui.js'),'Unified Search UI must remain the active search surface');
for(const legacyScript of [
  'src/source-hunt-oneclick.js',
  'src/source-hunt-playlist-provenance.js',
  'src/source-hunt-engine.js',
  'src/source-hunt-web.js',
  'src/source-hunt-enigma2.js',
])assert.equal(html.includes(legacyScript),false,`legacy active-page script must be retired: ${legacyScript}`);

assert.ok(html.includes('id="candidate-url"'),'manual candidate URL tester must remain available');
assert.ok(html.includes('id="test-candidate"'),'manual candidate playback action must remain available');
assert.ok(/Manual Source Test/.test(html),'legacy Source Hunt panel must be reframed as manual testing, not a second search surface');

for(const path of [
  '../src/search/search-ui.js',
  '../src/search/search-orchestrator.js',
  '../src/search/search-runtime.js',
  '../src/search/adapters/discovery-provider-adapter.js',
  '../src/search/adapters/hunt-exploration-adapter.js',
]){
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  for(const selector of ['#hunt-results','#hunt-curated-results','#hunt-seed-results','#hunt-web-results','#hunt-forum-results']){
    assert.equal(source.includes(selector),false,`${path} must not consume legacy result DOM ${selector}`);
  }
}

let searchedTarget='';
const run=runUnifiedSearch({
  query:'ERT1',
  context:{channels:[{id:'mega',name:'MEGA'},{id:'ert1',name:'ERT1'}],groups:[]},
  sources:[{id:'fixture',label:'Fixture',type:'fixture',enabled:true}],
  resolveAdapter:()=>({async search({target}){searchedTarget=target.name;return{candidates:[],leads:[],reports:[]};}}),
});
await run.done;
assert.equal(searchedTarget,'ERT1','free search target must not be rebound to the currently playing/sidebar channel');

console.log('Unified Search duplicate-Hunt retirement parity contract PASS');
