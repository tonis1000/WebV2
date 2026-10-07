export const IPTV_NEXUS_BASE_URL='https://dearbulut.github.io/iptv';
export const IPTV_NEXUS_MAX_BYTES=2000000;

function clean(value=''){return String(value||'').trim();}
function normalized(value=''){
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi,'')
    .trim();
}
function tvgIdentity(channel={}){
  const tvgId=clean(channel?.tvgId);
  const match=tvgId.match(/^(.+\.([a-z]{2}))(?:@([^@\s]+))?$/i);
  return match?{channelId:match[1],countryCode:match[2].toLowerCase(),feedId:clean(match[3])}:null;
}
export function nexusCountryCodeFor(channel={},planning={}){
  const exact=tvgIdentity(channel);
  if(exact?.countryCode)return exact.countryCode;
  const planned=clean(planning?.countryCode).toLowerCase();
  if(/^[a-z]{2}$/.test(planned))return planned;
  if(String(planning?.strategy||'')==='greece-curated'||String(planning?.strategy||'')==='targeted-refresh')return'gr';
  return'';
}
function channelNeedles(channel={}){
  const exact=tvgIdentity(channel);
  const ids=new Set();
  if(exact?.channelId)ids.add(exact.channelId.toLowerCase());
  for(const value of [channel?.tvgId,channel?.originalId,channel?.id]){
    const text=clean(value);
    if(/.+\.[a-z]{2}(?:@[^@\s]+)?$/i.test(text))ids.add(text.replace(/@[^@\s]+$/,'').toLowerCase());
  }
  const names=new Set([channel?.name,channel?.originalId,channel?.id].map(normalized).filter(Boolean));
  return{ids,names};
}
export function selectNexusChannel(rows=[],channel={}){
  const items=Array.isArray(rows)?rows:[];
  const needles=channelNeedles(channel);
  if(needles.ids.size){
    const exact=items.filter(item=>needles.ids.has(clean(item?.id).toLowerCase()));
    if(exact.length===1)return exact[0];
  }
  const matches=[];
  for(const item of items){
    const labels=[item?.name,...(Array.isArray(item?.alt_names)?item.alt_names:[])].map(normalized).filter(Boolean);
    if(labels.some(label=>needles.names.has(label)))matches.push(item);
  }
  return matches.length===1?matches[0]:null;
}
function safeHeaders(stream={}){
  const out={};
  const ua=clean(stream?.user_agent),ref=clean(stream?.referrer);
  if(ua&&!/[\r\n\0]/.test(ua))out['User-Agent']=ua;
  if(ref&&!/[\r\n\0]/.test(ref))out.Referer=ref;
  return out;
}
function safeNumber(value){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
export function nexusStreamCandidates(channelRow={},{
  channelName='',
  sourceFamilyId='',
  sourceOriginUrl='',
  maxStreams=12,
}={}){
  const streams=Array.isArray(channelRow?.streams)?channelRow.streams.slice(0,Math.max(1,Number(maxStreams)||12)):[];
  const out=[];
  for(const stream of streams){
    const url=clean(stream?.url);
    if(!/^https?:\/\//i.test(url))continue;
    const requiredHeaders=safeHeaders(stream);
    const health=stream?.health&&typeof stream.health==='object'?stream.health:{};
    const media=health?.media&&typeof health.media==='object'?health.media:{};
    out.push({
      channelName:clean(channelName||channelRow?.name),
      sourceType:/\.mpd(?:[?#]|$)/i.test(url)?'dash':/\.m3u8(?:[?#]|$)/i.test(url)?'hls':'direct',
      sourceUrl:url,
      sourceOrigin:'IPTV Nexus JSON',
      sourceOriginLabel:'IPTV Nexus intelligence',
      sourceFamilyId:clean(sourceFamilyId),
      discoveryProvider:'curated-remote-feeds',
      discoveredAt:new Date().toISOString(),
      freshness:'live-api-check',
      matchConfidence:'HIGH',
      saveEligible:true,
      verificationDetail:'IPTV Nexus intelligence candidate; advisory health does not replace WebTV verification/playback proof',
      sourceOriginUrl:clean(sourceOriginUrl),
      inputFormatId:'iptv-nexus-json',
      quality:clean(stream?.quality||channelRow?.best_quality),
      labels:[],
      requiredHeaders,
      sourceIntelligence:{
        provider:'iptv-nexus',
        channelId:clean(channelRow?.id),
        channelOnline:Boolean(channelRow?.online),
        channelScore:safeNumber(channelRow?.score),
        healthStatus:clean(health?.status),
        healthScore:safeNumber(health?.score),
        uptime:safeNumber(health?.uptime),
        checkedAt:clean(health?.checked_at),
        lastOnline:clean(health?.last_online),
        latencyMs:safeNumber(health?.latency_ms),
        quality:clean(stream?.quality||channelRow?.best_quality),
        rank:safeNumber(stream?.rank),
        sources:[...new Set((Array.isArray(stream?.sources)?stream.sources:[]).map(clean).filter(Boolean))].slice(0,16),
        media:{
          width:safeNumber(media?.width),
          height:safeNumber(media?.height),
          resolution:clean(media?.resolution),
          frameRate:safeNumber(media?.frame_rate),
          bitrate:safeNumber(media?.bitrate),
          videoCodec:clean(media?.video_codec),
          audioCodec:clean(media?.audio_codec),
          variants:safeNumber(media?.variants),
        },
      },
      sourceObservations:[{
        sourceFamilyId:clean(sourceFamilyId),
        sourceOrigin:'IPTV Nexus JSON',
        sourceOriginUrl:clean(sourceOriginUrl),
        inputFormatId:'iptv-nexus-json',
        freshness:'live-api-check',
        requiredHeaderNames:Object.keys(requiredHeaders),
        unsupportedDirectiveNames:[],
        enigma2ServiceType:'',
        enigma2Bouquet:'',
      }],
    });
  }
  return out;
}
