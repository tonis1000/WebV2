export const IPTV_ORG_STRUCTURED_STREAMS_URL='https://iptv-org.github.io/api/streams.json';
export const IPTV_ORG_STRUCTURED_MAX_BYTES=4000000;

export function parseIptvOrgIdentity(channel={}){
  const value=String(channel?.tvgId||'').trim();
  const match=value.match(/^(.+\.([a-z]{2}))(?:@([^@\s]+))?$/i);
  if(!match)return null;
  return {
    channelId:match[1],
    countryCode:match[2].toLowerCase(),
    feedId:String(match[3]||'').trim(),
  };
}

export function selectIptvOrgStreamRows(text='',channel={},limit=12){
  const identity=parseIptvOrgIdentity(channel);
  if(!identity)return [];
  let rows;
  try{rows=JSON.parse(String(text||''));}catch{return [];}
  if(!Array.isArray(rows))return [];
  const wantedChannel=identity.channelId.toLowerCase();
  const wantedFeed=identity.feedId.toLowerCase();
  const out=[];
  for(const row of rows){
    if(out.length>=limit)break;
    const upstreamChannel=String(row?.channel||'').trim();
    const upstreamFeed=String(row?.feed||'').trim();
    if(!upstreamChannel||upstreamChannel.toLowerCase()!==wantedChannel)continue;
    if(wantedFeed&&upstreamFeed.toLowerCase()!==wantedFeed)continue;
    const url=String(row?.url||'').trim();
    if(!url)continue;
    out.push({
      channel:upstreamChannel,
      feed:upstreamFeed,
      title:String(row?.title||'').trim(),
      url,
      referrer:String(row?.referrer||'').trim(),
      userAgent:String(row?.user_agent||'').trim(),
      quality:String(row?.quality||'').trim(),
      labels:Array.isArray(row?.labels)?row.labels.map(value=>String(value||'').trim()).filter(Boolean):[],
    });
  }
  return out;
}
