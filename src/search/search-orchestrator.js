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

function verificationSeverity(status=''){
  const value=String(status||'').toUpperCase();
  if(value==='VERIFIED')return 'OK';
  if(value==='TIMEOUT')return 'TIMEOUT';
  if(value==='UNVERIFIED'||value==='VERIFYING')return 'INFO';
  return 'ERROR';
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
  verifyBatch=null,
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
  const verificationTasks=[];
  const verificationScheduled=new Set();
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

  function scheduleVerification(candidates=[]){
    if(typeof verifyBatch!=='function'||controller.signal.aborted)return;
    const batch=[];
    for(const candidate of candidates||[]){
      const id=String(candidate?.candidateId||'').trim();
      if(!id||verificationScheduled.has(id))continue;
      verificationScheduled.add(id);
      batch.push(candidate);
    }
    if(!batch.length)return;
    const task=Promise.resolve().then(()=>verifyBatch(batch,{
      signal:controller.signal,
      onStart:candidate=>{
        if(controller.signal.aborted||state.snapshot().status!=='running')return;
        report.emit({type:'verification.started',severity:'INFO',candidateId:candidate?.candidateId||'',channelName:candidate?.channelName||'',stage:'verification'});
        notify();
      },
      onResult:(candidate,result)=>{
        if(controller.signal.aborted||state.snapshot().status!=='running')return;
        if(!state.replaceCandidate(searchId,candidate))return;
        const status=String(candidate?.verificationStatus||'FAILED');
        report.emit({type:'verification.completed',severity:verificationSeverity(status),candidateId:candidate?.candidateId||'',channelName:candidate?.channelName||'',stage:'verification',message:candidate?.verificationDetail||'',detail:{status,lastHttpStatus:candidate?.lastHttpStatus??null,mediaType:candidate?.resolvedMediaFormatId||candidate?.mediaType||'',drmDetected:Boolean(candidate?.drmDetected),rawStatus:result?.status||''}});
        notify();
      },
    })).catch(error=>{
      if(controller.signal.aborted||state.snapshot().status!=='running')return;
      for(const candidate of batch){
        report.emit({type:'verification.completed',severity:'ERROR',candidateId:candidate?.candidateId||'',channelName:candidate?.channelName||'',stage:'verification',message:error?.message||String(error),detail:{status:'FAILED'}});
      }
      notify();
    });
    verificationTasks.push(task);
  }

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
      for(const sourceReport of result?.reports||[]){
        const feed=String(sourceReport?.feed||'').trim();
        if(!feed)continue;
        const status=Number(sourceReport?.status||0);
        const count=Number(sourceReport?.count||0);
        const elapsedMs=Number.isFinite(Number(sourceReport?.elapsedMs))?Number(sourceReport.elapsedMs):null;
        const requiredHeaderCandidateCount=Number(sourceReport?.requiredHeaderCandidateCount||0);
        const requiredHeaderNames=Array.isArray(sourceReport?.requiredHeaderNames)?sourceReport.requiredHeaderNames.map(value=>String(value||'')).filter(Boolean):[];
        const unsupportedDirectiveNames=Array.isArray(sourceReport?.unsupportedDirectiveNames)?sourceReport.unsupportedDirectiveNames.map(value=>String(value||'')).filter(Boolean):[];
        const severity=status===408?'TIMEOUT':status>=200&&status<400?'OK':'ERROR';
        const safeFeedId=feed.replace(/[^a-z0-9_.-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'feed';
        const parts=[status?'HTTP '+status:'status 0',count+' hit'+(count===1?'':'s'),elapsedMs!==null?elapsedMs+' ms':''];
        if(requiredHeaderCandidateCount)parts.push(requiredHeaderCandidateCount+' header-aware');
        if(requiredHeaderNames.length)parts.push('headers: '+requiredHeaderNames.join(', '));
        if(unsupportedDirectiveNames.length)parts.push('unsupported directives: '+unsupportedDirectiveNames.join(', '));
        report.emit({type:'source.feed.completed',severity,laneId,sourceId:source.id+':'+safeFeedId,sourceLabel:feed,channelName:target.name||target.query||'',stage:'source-feed',durationMs:elapsedMs,message:parts.filter(Boolean).join(' · '),detail:{parentSourceId:source.id,tier:String(sourceReport?.tier||''),format:String(sourceReport?.format||''),status,count,requiredHeaderCandidateCount,requiredHeaderNames,unsupportedDirectiveNames,error:String(sourceReport?.error||'')}});
      }
      for(const action of result?.actions||[]){
        const actionType=String(action?.type||'candidate.action').trim()||'candidate.action';
        const origins=Array.isArray(action?.origins)?action.origins.map(value=>String(value||'')).filter(Boolean):[];
        const detail=action?.detail&&typeof action.detail==='object'?action.detail:{};
        report.emit({
          type:'source.'+actionType,
          severity:actionType==='candidate.header-conflict'?'WARN':actionType==='candidate.truncated'?'WARN':'INFO',
          laneId,
          sourceId:source.id,
          sourceLabel:origins.length?origins.join(' + '):(source.label||source.id),
          channelName:target.name||target.query||'',
          stage:'source-consolidation',
          message:String(action?.message||actionType),
          detail:{...detail,origins,sourceUrl:String(action?.sourceUrl||'')},
        });
      }
      for(const candidate of result?.candidates||[])report.emit({type:'candidate.found',severity:'OK',laneId,sourceId:source.id,sourceLabel:source.label||source.id,candidateId:candidate?.candidateId||'',channelName:candidate?.channelName||target.name||'',stage:'candidate',detail:{inputFormatId:candidate?.inputFormatId||source.type,resolvedMediaFormatId:candidate?.resolvedMediaFormatId||'',browserPlayable:candidate?.browserPlayable??null}});
      report.emit({type:'lane.completed',severity:'OK',laneId,sourceId:source.id,sourceLabel:source.label||source.id,channelName:target.name||target.query||'',stage:'search',durationMs:Date.now()-startedAt,detail:{candidateCount:result?.candidates?.length||0,leadCount:result?.leads?.length||0}});
      notify();
      scheduleVerification(result?.candidates||[]);
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
    if(verificationTasks.length)await Promise.allSettled([...verificationTasks]);
    if(state.snapshot().status==='running')state.completeSearch(searchId);
  }

  run.done=(async()=>{
    try{
      await execute();
      const snapshot=state.snapshot();
      if(!cancelled&&snapshot.status==='completed'){
        report.emit({type:'search.completed',severity:'OK',stage:'orchestrator',detail:{candidateCount:snapshot.candidates.length,leadCount:snapshot.leads.length}});
        notify();
      }
      return {snapshot:state.snapshot(),report:report.snapshot(),summary:report.summary(),intent};
    }finally{
      settled=true;
      if(activeRun===run)activeRun=null;
    }
  })();

  return run;
}
