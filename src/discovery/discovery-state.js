import { createCandidate } from './candidate-model.js';

export const FRESHNESS_OPTIONS = Object.freeze([
  Object.freeze({ id:'24h', label:'24h', days:1 }),
  Object.freeze({ id:'7d', label:'7d', days:7 }),
  Object.freeze({ id:'30d', label:'30d', days:30 }),
]);
export const DEFAULT_FRESHNESS = '7d';

export class DiscoveryState {
  constructor() {
    this.open=false;
    this.channel=null;
    this.freshness=DEFAULT_FRESHNESS;
    this.candidates=[];
  }
  setOpen(value){this.open=Boolean(value);return this.open;}
  setChannel(channel){
    this.channel=channel ? {
      id:String(channel.id||''),
      originalId:String(channel.originalId||''),
      name:String(channel.name||''),
      group:String(channel.group||''),
    } : null;
    this.candidates=this.channel ? phase1MockCandidates(this.channel) : [];
    return this.channel;
  }
  setFreshness(value){
    if (!FRESHNESS_OPTIONS.some(option=>option.id===value)) throw new Error(`Unsupported freshness: ${value}`);
    this.freshness=value;
    return this.freshness;
  }
  snapshot(){
    return Object.freeze({
      open:this.open,
      channel:this.channel ? Object.freeze({...this.channel}) : null,
      freshness:this.freshness,
      candidates:Object.freeze([...this.candidates]),
    });
  }
}

export function phase1MockCandidates(channel={}) {
  const name=String(channel.name||'Selected channel').trim();
  return [
    createCandidate({channelName:name,sourceType:'hls',sourceUrl:'https://phase1.invalid/live/playlist.m3u8',sourceOrigin:'Phase 1 mock',discoveryProvider:'local-shell',verificationStatus:'UNVERIFIED',matchConfidence:'HIGH'}),
    createCandidate({channelName:name,sourceType:'dash',sourceUrl:'https://phase1.invalid/live/manifest.mpd',sourceOrigin:'Phase 1 mock',discoveryProvider:'local-shell',verificationStatus:'UNVERIFIED',matchConfidence:'MEDIUM'}),
    createCandidate({channelName:name,sourceType:'strm',sourceUrl:'https://phase1.invalid/channel.strm',sourceOrigin:'Phase 1 mock',discoveryProvider:'local-shell',verificationStatus:'UNRESOLVED',matchConfidence:'MEDIUM'}),
  ];
}
