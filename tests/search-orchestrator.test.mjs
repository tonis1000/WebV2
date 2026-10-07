import assert from 'node:assert/strict';
import { runUnifiedSearch } from '../src/search/search-orchestrator.js';
import { createSearchReporter } from '../src/search/search-reporter.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

let active=0,maxActive=0;
const adapter={
  async search({target,source,signal}){
    active+=1;maxActive=Math.max(maxActive,active);
    try{
      if(source.id==='slow-timeout'){
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(resolve,80);
          signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason||new DOMException('aborted','AbortError'));},{once:true});
        });
      }else{
        await sleep(source.delay||5);
      }
      return {candidates:[{candidateId:`${source.id}:${target.id||target.name}`,channelName:target.name||target.query,sourceUrl:`https://stream.test/${source.id}.m3u8`}],leads:[],reports:source.id==='one'?[{feed:'iptv-org Greece',tier:'primary',format:'m3u',status:200,elapsedMs:17,count:1,requiredHeaderCandidateCount:1,requiredHeaderNames:['Referer'],error:''}]:[]};
    }finally{active-=1;}
  },
};
const resolveAdapter=()=>adapter;
const context={channels:[{id:'ert1',name:'ERT1'}],groups:[]};
const sources=[
  {id:'one',type:'fixture',enabled:true,delay:15},
  {id:'two',type:'fixture',enabled:true,delay:15},
  {id:'three',type:'fixture',enabled:true,delay:15},
  {id:'slow-timeout',type:'fixture',enabled:true},
];
const updates=[];
const reporter=createSearchReporter({searchId:'orchestrator-fixture'});
const run=runUnifiedSearch({query:'ERT1',context,sources,resolveAdapter,concurrency:2,laneTimeoutMs:25,onUpdate:update=>updates.push(update),reporter});
const result=await run.done;
assert.ok(maxActive<=2,`bounded concurrency exceeded: ${maxActive}`);
assert.equal(result.snapshot.status,'completed');
assert.equal(result.snapshot.candidates.length,3,'timed out lane must not block completed candidates');
assert.ok(updates.length>=4,'results/status should be emitted progressively');
assert.ok(updates.some(update=>update.snapshot?.candidates?.length===1),'at least one partial candidate update must be observable');
assert.ok(result.report.some(event=>event.type==='lane.timeout'&&event.sourceId==='slow-timeout'),'timeout must be reported with source identity');
assert.ok(result.report.some(event=>event.type==='search.completed'));
const feedEvent=result.report.find(event=>event.type==='source.feed.completed'&&event.sourceLabel==='iptv-org Greece');
assert.ok(feedEvent,'underlying curated feed must be visible in Search Report');
assert.equal(feedEvent.sourceId,'one:iptv-org-greece');
assert.equal(feedEvent.detail.status,200);
assert.equal(feedEvent.detail.count,1);
assert.equal(feedEvent.detail.requiredHeaderCandidateCount,1);
assert.deepEqual(feedEvent.detail.requiredHeaderNames,['Referer']);

let playerCalls=0;
globalThis.WebTVPlaybackAPI={play(){playerCalls+=1;},stop(){playerCalls+=1;},testCandidate(){playerCalls+=1;}};
const isolation=runUnifiedSearch({query:'ERT1',context,sources:[{id:'isolated',type:'fixture',enabled:true}],resolveAdapter,concurrency:1,laneTimeoutMs:50});
await isolation.done;
assert.equal(playerCalls,0,'search orchestration must never call Player APIs');
delete globalThis.WebTVPlaybackAPI;

const hangingAdapter={
  async search({signal}){
    await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason||new DOMException('aborted','AbortError')),{once:true}));
    return {candidates:[],leads:[],reports:[]};
  },
};
const first=runUnifiedSearch({query:'first unknown',context:{channels:[],groups:[]},sources:[{id:'hang',type:'fixture',enabled:true}],resolveAdapter:()=>hangingAdapter,laneTimeoutMs:5000});
await sleep(5);
const second=runUnifiedSearch({query:'ERT1',context,sources:[{id:'second',type:'fixture',enabled:true}],resolveAdapter,concurrency:1,laneTimeoutMs:50});
const [firstResult,secondResult]=await Promise.all([first.done,second.done]);
assert.equal(firstResult.snapshot.status,'cancelled','new search must supersede the active search');
assert.equal(firstResult.snapshot.cancelReason,'superseded');
assert.ok(firstResult.report.some(event=>event.type==='search.cancelled'));
assert.equal(secondResult.snapshot.status,'completed');

const manual=runUnifiedSearch({query:'ERT1',context,sources:[{id:'manual-hang',type:'fixture',enabled:true}],resolveAdapter:()=>hangingAdapter,laneTimeoutMs:5000});
await sleep(5);
manual.cancel('user');
const manualResult=await manual.done;
assert.equal(manualResult.snapshot.status,'cancelled');
assert.equal(manualResult.snapshot.cancelReason,'user');

console.log('progressive unified search orchestrator contract PASS');
