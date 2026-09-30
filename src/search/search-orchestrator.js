import { resolveSearchIntent } from './search-intent.js';
import { UnifiedSearchState } from './search-state.js';
import { listSearchSources } from './source-registry.js';
import { getSearchAdapter } from './adapter-registry.js';
import { createSearchReporter } from './search-reporter.js';

let activeRun=null;

function targetsFor(intent){
  if(Array.isArray(intent?.targets)&&intent.targets.length)return intent.targets;
  return [{id:'free-text',name:String(intent?.query||''),query:String(intent?.query||''),freeText:true}];
}

function laneIdFor(source,target,index){
  const targetKey=String(target?.id||target?.name||target?.query||index).replace(/[^a-z0-9_.-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase();
  return `${source.id}:${targetKey||index}`;
}

function childSignal(parentSignal,timeoutMs){
  const controller=new AbortController();
  const forward=()=>{if(!controller.signal.aborted)controller.abort(parentSignal.reason||new DOMException('cancelled','AbortError'));};
  if(parentSignal.aborted)forward();else parentSignal.addEventListener('abort',forward,{once:true});
  const timer=setTimeout(()=>{
    if(!controller.signal.aborted)controller.abort(new DOMException('lane timeout','TimeoutError'));
  },timeoutMs);
  return {signal:controller.signal,clear(){clearTimeout(timer);parentSignal.removeEventListener('abort',forward);}};
}

function abortKind(error,signal){
  const reason=signal?.reason||error;
  if(reason?.name==='TimeoutError'||error?.name==='TimeoutError')return 'timeout';
  if(signal?.aborted||error?.name==='AbortError')return 'cancelled';
  return 'error';
}

export function runUnifiedSearch({
  query='',
  context={},
  onUpdate=()=>{},
  sources=listSearchSources({enabledOnly:true}),
  resolveAdapter=getSearchAdapter,
  concurrency=3,
  laneTimeoutMs=10000,
  reporter=null,
}={}){
  if(activeRun&&!activeRun.settled)activeRun.cancel('superseded');

  const intent=resolveSearchIntent(query,context);
  const state=new UnifiedSearchState();
  const started=state.beginSearch({query,intent});
  const searchId=started.searchId;
  const report=reporter||createSearchReporter({searchId});
  const controller=new AbortController();
  const enabledSources=(sources||[]).filter(source=>source?.enabled!==false);
  const targets=targetsFor(intent);
  const jobs=[];
  let jobIndex=0;
  for(const source of enabledSources)for(const target of targets)jobs.push({source,target,laneId:laneIdFor(source,target,jobIndex++)});
  let cancelled=false;
  let settled=false;

  const notify=()=>{
    try{onUpdate({snapshot:state.snapshot(),report:report.snapshot(),summary:report.summary()});}catch{}
  };

  report.emit({type:'search.started',severity:'INFO',stage:'orchestrator',message:String(query||''),detail:{intentType:intent.type,targetCount:targets.length,laneCount:jobs.length}});
  notify();

  const cancel=(reason='user')=>{
    if(settled||cancelled)return false;
    cancelled=true;
    state.cancelSearch(searchId,reason);
    report.emit({type:'search.cancelled',severity:'WARN',stage:'orchestrator',message:String(reason||'cancelled')});
    if(!controller.signal.aborted)controller.abort(new DOMException(String(reason||'cancelled'),'AbortError'));
    notify();
    return true;
  };

  const run={cancel,done:null,get settled(){return settled;},searchId,reporter:report};
  activeRun=run;

  async function executeJob(job){
    if(controller.signal.aborted||state.snapshot().status!=='running')return;
    const {source,target,laneId}=job;
    state.setLaneStatus(searchId,laneId,'running');
    report.emit({type:'lane.started',severity:'INFO',laneId,sourceId:source.id,sourceLabel:source.label||source.id,channelName:target.name||target.query||'',stage:'search'});
    notify();
    const timed=childSignal(controller.signal,Math.max(1,Number(laneTimeoutMs)||10000));
    const startedAt=Date.now();
    try{
      const adapter=resolveAdapter(source.type);
      const result=await adapter.search({target,source,signal:timed.signal});
      if(controller.signal.aborted||state.snapshot().status!=='running')return;
      state.mergeLaneResult(searchId,laneId,result||{});
      state.setLaneStatus(searchId,laneId,'done');
      for(const candidate of result?.candidates||[])report.emit({type:'candidate.found',severity:'OK',laneId,sourceId:source.id,sourceLabel:source.label||source.id,candidateId:candidate?.candidateId||'',channelName:candidate?.channelName||target.name||'',stage:'candidate',detail:{inputFormatId:candidate?.inputFormatId||source.type,resolvedMediaFormatId:candidate?.resolvedMediaFormatId||'',browserPlayable:candidate?.browserPlayable??null}});
      report.emit({type:'lane.completed',severity:'OK',laneId,sourceId:source.id,sourceLabel:source.label||source.id,channelName:target.name||target.query||'',stage:'search',durationMs:Date.now()-startedAt,detail:{candidateCount:result?.candidates?.length||0,leadCount:result?.leads?.length||0}});
      notify();
    }catch(error){
      const kind=abortKind(error,timed.signal);
      if(controller.signal.aborted||state.snapshot().status!=='running')return;
      if(kind==='timeout'){
        state.setLaneStatus(searchId,laneId,'timeout',error?.message||'timeout');
        report.emit({type:'lane.timeout',severity:'TIMEOUT',laneId,sourceId:source.id,sourceLabel:source.label||source.id,channelName:target.name||target.query||'',stage:'search',durationMs:Date.now()-startedAt,message:error?.message||'lane timeout'});
      }else{
        state.setLaneStatus(searchId,laneId,'error',error?.message||String(error));
        report.emit({type:'lane.failed',severity:'ERROR',laneId,sourceId:source.id,sourceLabel:source.label||source.id,channelName:target.name||target.query||'',stage:'search',durationMs:Date.now()-startedAt,message:error?.message||String(error)});
      }
      notify();
    }finally{timed.clear();}
  }

  async function execute(){
    let next=0;
    const workerCount=Math.max(1,Math.min(Math.max(1,Number(concurrency)||1),jobs.length||1));
    const workers=Array.from({length:workerCount},async()=>{
      while(true){
        if(controller.signal.aborted)return;
        const index=next++;
        if(index>=jobs.length)return;
        await executeJob(jobs[index]);
      }
    });
    await Promise.all(workers);
    if(state.snapshot().status==='running'){
      state.completeSearch?.(searchId);
      if(state.snapshot().status==='running'){
        // Completion is intentionally owned here; older state versions may not expose completeSearch.
        state.cancelSearch(searchId,'__complete__');
      }
    }
  }

  run.done=(async()=>{
    try{
      await execute();
      let snapshot=state.snapshot();
      if(snapshot.status==='cancelled'&&snapshot.cancelReason==='__complete__'){
        // Preserve a true completed state without teaching search state about Player or transport concerns.
        snapshot=Object.freeze({...snapshot,status:'completed',cancelReason:'',completedAt:snapshot.completedAt||new Date().toISOString()});
      }
      if(!cancelled&&snapshot.status==='completed'){
        report.emit({type:'search.completed',severity:'OK',stage:'orchestrator',detail:{candidateCount:snapshot.candidates.length,leadCount:snapshot.leads.length}});
        notify();
      }
      return {snapshot,report:report.snapshot(),summary:report.summary(),intent};
    }finally{
      settled=true;
      if(activeRun===run)activeRun=null;
    }
  })();

  return run;
}
