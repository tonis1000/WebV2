export const FRESHNESS_OPTIONS = Object.freeze([
  Object.freeze({ id:'24h', label:'24h', days:1 }),
  Object.freeze({ id:'7d', label:'7d', days:7 }),
  Object.freeze({ id:'30d', label:'30d', days:30 }),
]);
export const DEFAULT_FRESHNESS = '7d';

const EMPTY_LANES=Object.freeze({myPlaylist:0,savedPlaylists:0,xtream:0,curatedRemoteFeeds:0,githubPublicPlaylists:0,recentWebSearch:0,total:0});

function uniqueCandidates(items=[]){
  const seen=new Set();const out=[];
  for(const item of items||[]){
    const key=String(item?.sourceUrl||item?.candidateId||'').trim();
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function isLocalCandidate(item){return String(item?.discoveryProvider||'').startsWith('local-');}

export class DiscoveryState {
  constructor() {
    this.open=false;this.channel=null;this.freshness=DEFAULT_FRESHNESS;this.candidates=[];this.lanes=EMPTY_LANES;
    this.scanStatus='idle';this.scanMessage='';this.lastScanAt=null;this.externalStatus='idle';this.externalMessage='';this.verifyStatus='idle';this.verifyMessage='';
  }
  setOpen(value){this.open=Boolean(value);return this.open;}
  setChannel(channel){
    this.channel=channel ? {id:String(channel.id||''),originalId:String(channel.originalId||''),name:String(channel.name||''),group:String(channel.group||''),tvgId:String(channel.tvgId||'')} : null;
    this.clearResults();return this.channel;
  }
  setFreshness(value){if (!FRESHNESS_OPTIONS.some(option=>option.id===value)) throw new Error(`Unsupported freshness: ${value}`);this.freshness=value;return this.freshness;}
  setScanning(message='Reading local sources…'){this.scanStatus='loading';this.scanMessage=String(message||'');}
  setScanResult({candidates=[],lanes=EMPTY_LANES,message=''}={}){
    const external=this.candidates.filter(item=>!isLocalCandidate(item));
    this.candidates=uniqueCandidates([...(candidates||[]),...external]);
    this.lanes=Object.freeze({...EMPTY_LANES,...this.lanes,...(lanes||{}),total:this.candidates.length});
    this.scanStatus='done';this.scanMessage=String(message||'');this.lastScanAt=new Date().toISOString();this.verifyStatus='idle';this.verifyMessage='';
  }
  setScanError(message='Local scan failed'){this.scanStatus='error';this.scanMessage=String(message||'Local scan failed');}
  setExternalScanning(message='Searching external providers…'){this.externalStatus='loading';this.externalMessage=String(message||'');}
  mergeExternalResult({provider='curated-remote-feeds',lane='curatedRemoteFeeds',candidates=[],count=null,message=''}={}){
    const retained=this.candidates.filter(item=>String(item?.discoveryProvider||'')!==provider);
    this.candidates=uniqueCandidates([...retained,...(candidates||[])]);
    const externalCount=count===null?(candidates||[]).length:Number(count)||0;
    this.lanes=Object.freeze({...EMPTY_LANES,...this.lanes,[lane]:externalCount,total:this.candidates.length});
    if(this.scanStatus==='idle')this.scanStatus='done';
    this.externalStatus='done';this.externalMessage=String(message||'');this.lastScanAt=new Date().toISOString();this.verifyStatus='idle';this.verifyMessage='';
  }
  setExternalError(message='External discovery failed'){this.externalStatus='error';this.externalMessage=String(message||'External discovery failed');}
  setExternalIdle(message=''){this.externalStatus='idle';this.externalMessage=String(message||'');}
  setVerificationRunning(message='Verifying candidates…'){this.verifyStatus='loading';this.verifyMessage=String(message||'');}
  setVerificationMessage(message='',status='done'){this.verifyStatus=status;this.verifyMessage=String(message||'');}
  replaceCandidate(candidate){const id=String(candidate?.candidateId||'');if(!id)return false;const index=this.candidates.findIndex(item=>String(item?.candidateId||'')===id);if(index<0)return false;this.candidates=[...this.candidates.slice(0,index),candidate,...this.candidates.slice(index+1)];return true;}
  clearResults(){this.candidates=[];this.lanes=EMPTY_LANES;this.scanStatus='idle';this.scanMessage='';this.lastScanAt=null;this.externalStatus='idle';this.externalMessage='';this.verifyStatus='idle';this.verifyMessage='';}
  snapshot(){return Object.freeze({open:this.open,channel:this.channel ? Object.freeze({...this.channel}) : null,freshness:this.freshness,candidates:Object.freeze([...this.candidates]),lanes:this.lanes,scanStatus:this.scanStatus,scanMessage:this.scanMessage,lastScanAt:this.lastScanAt,externalStatus:this.externalStatus,externalMessage:this.externalMessage,verifyStatus:this.verifyStatus,verifyMessage:this.verifyMessage});}
}
