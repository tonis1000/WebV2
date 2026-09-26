import xtreamBase from './webtv-xtream.js';

const VERSION='1.8';
export const AUTHORIZED_XTREAM_DISCOVERY_PROVIDER='authorized-xtream-expansion';
export const XTREAM_DISCOVERY_MAX_ACCOUNTS=3;
export const XTREAM_DISCOVERY_MAX_STREAMS_PER_ACCOUNT=5000;
export const XTREAM_DISCOVERY_MAX_CANDIDATES=8;

function clean(value=''){return String(value??'').trim();}
function cors(origin='*'){
  return {
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers':'content-type,authorization,x-webtv-session,range',
    'access-control-expose-headers':'content-length,content-range,accept-ranges',
    'access-control-max-age':'86400',
  };
}
function json(data,status=200,origin='*'){
  return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
}
function requestOrigin(request,env){
  const allowed=clean(env.ALLOWED_ORIGIN);
  if(!allowed||allowed==='*')return '*';
  const origin=request.headers.get('origin')||'';
  return origin===allowed?origin:allowed;
}
function normalizeName(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();
}
function discoveryKey(value=''){
  return normalizeName(value).replace(/\s+(?:hd|tv|greece|greek|gr)$/i,'').trim();
}
function channelMatches(selected={},candidate={}){
  const wanted=new Set([selected.id,selected.originalId,selected.tvgId,selected.name].map(discoveryKey).filter(Boolean));
  if(!wanted.size)return false;
  return [candidate.id,candidate.tvgId,candidate.name].map(discoveryKey).filter(Boolean).some(key=>wanted.has(key));
}
function cloneWithUrl(request,path,method='GET',body){
  const url=new URL(path,request.url);
  const headers=new Headers(request.headers);
  const init={method,headers,cache:'no-store'};
  if(body!==undefined){headers.set('content-type','application/json');init.body=JSON.stringify(body);}
  return new Request(url.toString(),init);
}
async function baseJson(request,env,path,method='GET',body){
  const response=await xtreamBase.fetch(cloneWithUrl(request,path,method,body),env);
  let data={};try{data=await response.json();}catch{}
  return{response,data};
}
async function discover(request,env,channel={}){
  const listed=await baseJson(request,env,'/api/accounts');
  if(!listed.response.ok)return listed.response;
  const accounts=(Array.isArray(listed.data.accounts)?listed.data.accounts:[]).slice(0,XTREAM_DISCOVERY_MAX_ACCOUNTS);
  const candidates=[];const reports=[];
  for(const account of accounts){
    const accountRef=clean(account.id);if(!accountRef)continue;
    const loaded=await baseJson(request,env,`/api/accounts/${encodeURIComponent(accountRef)}/channels`);
    if(!loaded.response.ok){reports.push({accountRef,accountName:clean(account.name),status:loaded.response.status,streamsScanned:0,matches:0,error:clean(loaded.data.error)||`HTTP ${loaded.response.status}`});continue;}
    const channels=(Array.isArray(loaded.data.channels)?loaded.data.channels:[]).slice(0,XTREAM_DISCOVERY_MAX_STREAMS_PER_ACCOUNT);
    let matches=0;
    for(const item of channels){
      if(!channelMatches(channel,item))continue;
      const streamId=clean(item.streamId);const playbackUrl=clean(item.playbackUrl);
      if(!streamId||!/^https?:\/\//i.test(playbackUrl))continue;
      matches+=1;
      candidates.push({
        channelName:clean(channel.name||channel.originalId||channel.id),
        sourceType:'xtream',sourceUrl:playbackUrl,
        sourceOrigin:`Xtream · ${clean(account.name||account.server||accountRef)}`,
        discoveryProvider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,
        verificationStatus:'UNVERIFIED',matchConfidence:'HIGH',
        freshness:'authorized-account-live-catalog',
        xtreamAccountRef:accountRef,xtreamStreamId:streamId,xtreamServer:clean(account.server),
      });
      if(candidates.length>=XTREAM_DISCOVERY_MAX_CANDIDATES)break;
    }
    reports.push({accountRef,accountName:clean(account.name),status:200,streamsScanned:channels.length,matches,error:''});
    if(candidates.length>=XTREAM_DISCOVERY_MAX_CANDIDATES)break;
  }
  return json({provider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER,candidates,reports,limits:{maxAccounts:XTREAM_DISCOVERY_MAX_ACCOUNTS,maxStreamsPerAccount:XTREAM_DISCOVERY_MAX_STREAMS_PER_ACCOUNT,maxCandidates:XTREAM_DISCOVERY_MAX_CANDIDATES}},200,requestOrigin(request,env));
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);const path=url.pathname.replace(/\/+$/,'')||'/';const origin=requestOrigin(request,env);
    if(path==='/api/discovery/search'&&request.method==='POST'){
      if(String(env.DISABLE_AUTHORIZED_XTREAM_DISCOVERY||'')==='1')return json({error:'Authorized Xtream discovery disabled',provider:AUTHORIZED_XTREAM_DISCOVERY_PROVIDER},503,origin);
      let payload={};try{payload=await request.json();}catch{return json({error:'Invalid JSON body'},400,origin);}
      const channel=payload?.channel&&typeof payload.channel==='object'?payload.channel:{};
      if(![channel.id,channel.originalId,channel.tvgId,channel.name].some(value=>clean(value)))return json({error:'Channel identity is required'},400,origin);
      return discover(request,env,channel);
    }
    if((path==='/'||path==='/api/status')&&request.method==='GET'){
      const base=await xtreamBase.fetch(request,env);let data={};try{data=await base.json();}catch{}
      if(!base.ok)return json(data,base.status,origin);
      return json({...data,version:VERSION,authorizedDiscovery:String(env.DISABLE_AUTHORIZED_XTREAM_DISCOVERY||'')!=='1',authorizedDiscoveryLimits:{maxAccounts:XTREAM_DISCOVERY_MAX_ACCOUNTS,maxStreamsPerAccount:XTREAM_DISCOVERY_MAX_STREAMS_PER_ACCOUNT,maxCandidates:XTREAM_DISCOVERY_MAX_CANDIDATES}},200,origin);
    }
    return xtreamBase.fetch(request,env);
  },
};
