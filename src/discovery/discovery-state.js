export const FRESHNESS_OPTIONS = Object.freeze([
  Object.freeze({ id:'24h', label:'24h', days:1 }),
  Object.freeze({ id:'7d', label:'7d', days:7 }),
  Object.freeze({ id:'30d', label:'30d', days:30 }),
]);
export const DEFAULT_FRESHNESS = '7d';

const EMPTY_LANES=Object.freeze({myPlaylist:0,savedPlaylists:0,xtream:0,total:0});

export class DiscoveryState {
  constructor() {
    this.open=false;
    this.channel=null;
    this.freshness=DEFAULT_FRESHNESS;
    this.candidates=[];
    this.lanes=EMPTY_LANES;
    this.scanStatus='idle';
    this.scanMessage='';
    this.lastScanAt=null;
  }
  setOpen(value){this.open=Boolean(value);return this.open;}
  setChannel(channel){
    this.channel=channel ? {
      id:String(channel.id||''),
      originalId:String(channel.originalId||''),
      name:String(channel.name||''),
      group:String(channel.group||''),
    } : null;
    this.clearResults();
    return this.channel;
  }
  setFreshness(value){
    if (!FRESHNESS_OPTIONS.some(option=>option.id===value)) throw new Error(`Unsupported freshness: ${value}`);
    this.freshness=value;
    return this.freshness;
  }
  setScanning(message='Reading local sources…'){
    this.scanStatus='loading';
    this.scanMessage=String(message||'');
  }
  setScanResult({candidates=[],lanes=EMPTY_LANES,message=''}={}){
    this.candidates=[...(candidates||[])];
    this.lanes=Object.freeze({...EMPTY_LANES,...(lanes||{})});
    this.scanStatus='done';
    this.scanMessage=String(message||'');
    this.lastScanAt=new Date().toISOString();
  }
  setScanError(message='Local scan failed'){
    this.scanStatus='error';
    this.scanMessage=String(message||'Local scan failed');
  }
  clearResults(){
    this.candidates=[];
    this.lanes=EMPTY_LANES;
    this.scanStatus='idle';
    this.scanMessage='';
    this.lastScanAt=null;
  }
  snapshot(){
    return Object.freeze({
      open:this.open,
      channel:this.channel ? Object.freeze({...this.channel}) : null,
      freshness:this.freshness,
      candidates:Object.freeze([...this.candidates]),
      lanes:this.lanes,
      scanStatus:this.scanStatus,
      scanMessage:this.scanMessage,
      lastScanAt:this.lastScanAt,
    });
  }
}
