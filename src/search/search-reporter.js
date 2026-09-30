const SEVERITIES=new Set(['INFO','OK','WARN','ERROR','TIMEOUT','SKIPPED']);
const SENSITIVE_KEYS=/^(?:username|user|password|passwd|pass|authorization|cookie|set-cookie|token|access_token|refresh_token|api[_-]?key|secret|client_secret|previewtoken|xtreampreviewtoken)$/i;
const SENSITIVE_QUERY_KEYS=new Set(['username','user','password','passwd','pass','authorization','auth','cookie','token','access_token','refresh_token','apikey','api_key','key','secret']);

function redactUrl(value=''){
  try{
    const url=new URL(String(value||''));
    if(!/^https?:$/.test(url.protocol))return '[redacted non-public URL]';
    if(url.username||url.password){url.username='';url.password='';}
    for(const key of [...url.searchParams.keys()]){
      if(SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase()))url.searchParams.set(key,'[redacted]');
    }
    const parts=url.pathname.split('/');
    if(parts.length>=5&&['live','movie','series'].includes(String(parts[1]||'').toLowerCase())){
      parts[2]='[redacted]';parts[3]='[redacted]';url.pathname=parts.join('/');
    }
    return url.toString().replaceAll('%5Bredacted%5D','[redacted]');
  }catch{return '[redacted URL]';}
}

function looksLikeUrl(value=''){
  return /^(?:https?|rtsp|rtsps|rtmp|rtmps|file):\/\//i.test(String(value||'').trim());
}

function redact(value,key=''){
  if(SENSITIVE_KEYS.test(String(key||'')))return '[redacted]';
  if(value===null||value===undefined)return value;
  if(typeof value==='string')return looksLikeUrl(value)?redactUrl(value):value;
  if(Array.isArray(value))return value.map(item=>redact(item));
  if(typeof value==='object'){
    const out={};
    for(const [childKey,childValue] of Object.entries(value))out[childKey]=redact(childValue,childKey);
    return out;
  }
  return value;
}

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))deepFreeze(child);
  return Object.freeze(value);
}

function normalizeEvent(searchId,eventId,input={}){
  const severity=SEVERITIES.has(String(input.severity||'').toUpperCase())?String(input.severity).toUpperCase():'INFO';
  const raw={
    eventId,
    searchId,
    at:String(input.at||new Date().toISOString()),
    severity,
    type:String(input.type||'event.unknown'),
    laneId:String(input.laneId||''),
    sourceId:String(input.sourceId||''),
    sourceLabel:String(input.sourceLabel||''),
    candidateId:String(input.candidateId||''),
    channelName:String(input.channelName||''),
    stage:String(input.stage||''),
    durationMs:Number.isFinite(Number(input.durationMs))?Number(input.durationMs):null,
    message:String(input.message||''),
    detail:redact(input.detail??null),
  };
  return deepFreeze(raw);
}

function uniqueCount(events,predicate,keyOf){
  const keys=new Set();
  for(const event of events)if(predicate(event)){const key=keyOf(event);if(key)keys.add(key);}
  return keys.size;
}

export function createSearchReporter({searchId,maxEvents=1000}={}){
  const id=String(searchId||'').trim();
  if(!id)throw new Error('searchId is required');
  const limit=Math.max(1,Number(maxEvents)||1000);
  const events=[];
  let sequence=0;
  let runStatus='idle';

  function emit(input={}){
    const event=normalizeEvent(id,`${id}:${++sequence}`,input);
    events.push(event);
    if(events.length>limit)events.splice(0,events.length-limit);
    if(event.type==='search.started')runStatus='running';
    else if(event.type==='search.completed')runStatus='completed';
    else if(event.type==='search.cancelled')runStatus='cancelled';
    return event;
  }

  function snapshot(){return deepFreeze([...events]);}

  function summary(){
    const current=snapshot();
    return Object.freeze({
      searchId:id,
      status:runStatus,
      total:current.length,
      completed:current.filter(event=>event.type==='lane.completed').length,
      failed:current.filter(event=>event.severity==='ERROR').length,
      timeouts:current.filter(event=>event.severity==='TIMEOUT').length,
      warnings:current.filter(event=>event.severity==='WARN').length,
      candidates:uniqueCount(current,event=>event.type==='candidate.found',event=>event.candidateId||`${event.channelName}:${event.eventId}`),
      verified:uniqueCount(current,event=>event.type==='verification.completed'&&String(event.detail?.status||'').toUpperCase()==='VERIFIED',event=>event.candidateId||event.eventId),
    });
  }

  function filterBySource(sourceId){const key=String(sourceId||'');return deepFreeze(events.filter(event=>event.sourceId===key));}
  function filterByCandidate(candidateId){const key=String(candidateId||'');return deepFreeze(events.filter(event=>event.candidateId===key));}
  function exportJson(){return JSON.stringify(snapshot(),null,2);}
  function exportText(){
    return snapshot().map(event=>{
      const scope=[event.laneId,event.sourceLabel||event.sourceId,event.channelName,event.candidateId].filter(Boolean).join(' · ');
      const detail=event.detail===null?'':` · ${JSON.stringify(event.detail)}`;
      return `${event.at} [${event.severity}] ${event.type}${scope?` · ${scope}`:''}${event.message?` · ${event.message}`:''}${detail}`;
    }).join('\n');
  }

  return Object.freeze({emit,snapshot,summary,filterBySource,filterByCandidate,exportText,exportJson});
}
