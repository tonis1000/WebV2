import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runUnifiedSearch } from '../src/search/search-orchestrator.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.includes('src/search/search-ui.js'),'Unified Search UI must remain the active search surface');
assert.equal(html.includes('src/source-hunt-oneclick.js'),false,'legacy One-Click DOM merger must not load in the active page');
assert.equal(html.includes('src/source-hunt-playlist-provenance.js'),false,'legacy DOM provenance augmenter must not load in the active page');

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

console.log('Unified Search legacy One-Click parity contract PASS');
