import assert from 'node:assert/strict';
import { createDiscoveryProviderAdapter } from '../src/search/adapters/discovery-provider-adapter.js';
import { createHuntExplorationAdapter } from '../src/search/adapters/hunt-exploration-adapter.js';

const calls=[];
const discovery=createDiscoveryProviderAdapter({
  discoverers:{
    'recent-web-search':async(target,options)=>{calls.push({provider:'recent-web-search',target,options});return{candidates:[{candidateId:'web1'}],reports:[{ok:true}]};},
    'curated-remote-feeds':async(target,options)=>{calls.push({provider:'curated-remote-feeds',target,options});return{candidates:[{candidateId:'cur1'}],reports:[]};},
  },
});
const controller=new AbortController();
const web=await discovery.search({target:{id:'ert1',name:'ERT1'},source:{id:'recent-web',provider:'recent-web-search',freshness:'30d'},signal:controller.signal});
assert.deepEqual(web.candidates,[{candidateId:'web1'}]);
assert.deepEqual(web.leads,[]);
assert.equal(calls[0].target.name,'ERT1');
assert.equal(calls[0].options.freshness,'30d');
assert.equal(calls[0].options.signal,controller.signal);
await assert.rejects(()=>discovery.search({target:{name:'ERT1'},source:{id:'official',provider:'official-provider-lane'},signal:controller.signal}),/unsupported discovery provider/i,'Official must not sneak into unified adapter');

const huntPayload={
  groups:{
    seed:[{url:'https://stream.test/seed.m3u8',origin:'Seed'}],
    web:[{url:'https://stream.test/web.m3u8',origin:'Web'}],
    forums:[{url:'https://stream.test/forum.m3u8',origin:'Reddit',source:'https://www.reddit.com/r/test/comments/1/source',sourceType:'hls'}],
    webLeads:[{url:'https://example.test/page',origin:'Fresh Web',title:'possible source'}],
    forumLeads:[{url:'https://www.reddit.com/r/test/comments/2/lead',origin:'Reddit',title:'lead'}],
  },
  debug:[{stage:'hunt',ok:true}],
};
let requested='';
const hunt=createHuntExplorationAdapter({endpoint:'https://hunt.test',fetchImpl:async(url)=>{requested=String(url);return new Response(JSON.stringify(huntPayload),{status:200,headers:{'content-type':'application/json'}});}});
const huntResult=await hunt.search({target:{id:'ert1',name:'ERT1'},source:{id:'hunt-exploration',label:'Hunt Exploration'},signal:new AbortController().signal});
assert.match(requested,/\/hunt\?/);
assert.match(requested,/channel=ERT1/);
assert.equal(huntResult.candidates.length,1,'Hunt adapter must keep unique forum candidates only, not duplicate seed/web candidate lanes');
assert.equal(huntResult.candidates[0].sourceUrl,'https://stream.test/forum.m3u8');
assert.equal(huntResult.candidates[0].sourceOriginUrl,'https://www.reddit.com/r/test/comments/1/source');
assert.equal(huntResult.leads.length,2);
assert.ok(huntResult.leads.every(item=>item.sourceUrl),'leads must carry inspectable origin URLs');

console.log('unified search provider adapter contract PASS');
