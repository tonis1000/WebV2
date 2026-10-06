import { normalizeId, normalizeIptvHeaders, parseIptvUrl } from './utils.js?v=20260920-1021';
import { parseM3uContainer } from './m3u-container.js?v=20260930-m3u-container-e2';
import { resolveGreekIdentity } from './channel-identity-gr.js';

const SOURCE_HINT_PATTERNS = Object.freeze([
  { key:'bup', pattern:/\s+bup$/i, roleHint:'backup' },
  { key:'github', pattern:/\s+github$/i, wrapperHint:'github' },
  { key:'msvdn', pattern:/\s+msvdn$/i, providerHint:'msvdn' },
  { key:'ucdn', pattern:/\s+ucdn$/i, providerHint:'ucdn' },
  { key:'hbbtv', pattern:/\s+hbbtv$/i, providerHint:'hbbtv' },
  { key:'smart', pattern:/\s+\.?smart$/i, providerHint:'smart' },
  { key:'lcdn', pattern:/\s+\.?lcdn$/i, providerHint:'lcdn' },
  { key:'amagi', pattern:/\s+amagi$/i, providerHint:'amagi' },
  { key:'rakuten', pattern:/\s+rakut+en$/i, providerHint:'rakuten' },
  { key:'samsung', pattern:/\s+samsung$/i, providerHint:'samsung' },
  { key:'xumo', pattern:/\s+xumo$/i, providerHint:'xumo' },
  { key:'plex', pattern:/\s+plex$/i, providerHint:'plex' },
  { key:'wurl', pattern:/\s+wurl$/i, providerHint:'wurl' },
  { key:'akamaized', pattern:/\s+akamaized$/i, providerHint:'akamaized' },
  { key:'cloudskep', pattern:/\s+cloudskep$/i, providerHint:'cloudskep' },
  { key:'streamer', pattern:/\s+streamer$/i, providerHint:'streamer' },
  { key:'rtmp', pattern:/\s+rtmp$/i, providerHint:'rtmp' },
  { key:'telmaco', pattern:/\s+telmaco$/i, providerHint:'telmaco' },
  { key:'bozztv', pattern:/\s+bozztv$/i, providerHint:'bozztv' },
]);

function stripCatalogPrefix(value='') {
  return String(value||'').trim().replace(/^\s*(?:GR|SP|CINE|DOC|\.?MUSIC|\.?GR\s+KIDS)\s*:\s*/i,'').trim();
}

function sourceLabelInfo(value='') {
  const originalLabel=String(value||'').trim();
  let baseName=stripCatalogPrefix(originalLabel);
  const hints=[];
  let roleHint='';
  let providerHint='';
  let wrapperHint='';
  let changed=true;
  while(changed && baseName){
    changed=false;
    for(const item of SOURCE_HINT_PATTERNS){
      if(!item.pattern.test(baseName))continue;
      baseName=baseName.replace(item.pattern,'').trim();
      if(!hints.includes(item.key))hints.unshift(item.key);
      if(item.roleHint)roleHint=item.roleHint;
      if(item.providerHint&&!providerHint)providerHint=item.providerHint;
      if(item.wrapperHint)wrapperHint=item.wrapperHint;
      changed=true;
      break;
    }
  }
  return {originalLabel,baseName:baseName||stripCatalogPrefix(originalLabel)||originalLabel,hints,roleHint,providerHint,wrapperHint};
}

function unusableExternalId(value='') {
  const raw=String(value||'').trim();
  if(!raw)return true;
  const normalized=raw.toLowerCase().replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();
  if(!normalized)return true;
  if(['dummy','unknown','none','null','n a','na','test'].includes(normalized))return true;
  if(/^\?+$/.test(raw)||/https?:\/\//i.test(raw))return true;
  if(/^hls\s+stream\b/i.test(normalized))return true;
  if(/^ert\s+auto\b/i.test(normalized))return true;
  return false;
}

function canonicalIdentityFor({rawId='',name='',baseName=''}) {
  for(const value of [baseName,name,!unusableExternalId(rawId)?rawId:'']){
    if(!value)continue;
    const identity=resolveGreekIdentity(value);
    if(identity)return identity;
  }
  return null;
}

function parseDirectiveHeaders(directives=[]) {
  const headers={};
  for(const line of Array.isArray(directives)?directives:[]){
    const match=String(line||'').trim().match(/^#EXTVLCOPT\s*:\s*([^=]+)=(.*)$/i);
    if(!match)continue;
    const key=String(match[1]||'').trim().toLowerCase();
    const value=String(match[2]||'').trim();
    if(!value)continue;
    if(key==='http-user-agent')headers['User-Agent']=value;
    else if(key==='http-referrer'||key==='http-referer')headers.Referer=value;
    else if(key==='http-origin')headers.Origin=value;
  }
  return normalizeIptvHeaders(headers);
}

function sourceWithDirectiveHeaders(rawSource='',directiveHeaders={}) {
  const raw=String(rawSource||'').trim();
  if(!raw||!Object.keys(directiveHeaders||{}).length)return raw;
  const pipeIndex=raw.indexOf('|');
  const urlPart=(pipeIndex>=0?raw.slice(0,pipeIndex):raw).trim();
  const optionsPart=pipeIndex>=0?raw.slice(pipeIndex+1).trim():'';
  const params=new URLSearchParams();
  for(const [name,value] of Object.entries(directiveHeaders))params.set(name,value);
  const prefix=params.toString();
  return optionsPart?urlPart+'|'+prefix+'&'+optionsPart:urlPart+'|'+prefix;
}

function mergeSourceMeta(current=[],incoming=[]) {
  const out=[];const seen=new Set();
  for(const item of [...(current||[]),...(incoming||[])]){
    if(!item)continue;
    const key=String(item.url||'')+'|'+String(item.originalUrl||'')+'|'+String(item.originalLabel||'');
    if(seen.has(key))continue;
    seen.add(key);out.push({...item,hints:[...(item.hints||[])]});
  }
  return out;
}

export function parseM3U(text = '') {
  const channels = [];
  for (const entry of parseM3uContainer(text)) {
    if (!entry.extinf.startsWith('#EXTINF')) continue;
    const fallbackName = entry.title || '';
    const rawId = entry.attributes['tvg-id'] || '';
    const name = entry.attributes['tvg-name'] || fallbackName || rawId || 'Unknown';
    const labelInfo = sourceLabelInfo(name || fallbackName);
    const canonical = canonicalIdentityFor({rawId,name,baseName:labelInfo.baseName});
    const identitySource = canonical ? 'canonical' : (unusableExternalId(rawId) ? 'name-fallback' : 'tvg-id');
    const idValue = canonical?.id || (identitySource==='tvg-id' ? rawId : (labelInfo.baseName || name));
    const logo = entry.attributes['tvg-logo'] || '';
    const group = entry.attributes['group-title'] || 'Other';
    const rawSource = (entry.sourceCandidates || []).find(candidate => /^https?:\/\//i.test(candidate.line || ''))?.line || '';
    const directiveHeaders = parseDirectiveHeaders(entry.directivesBeforeSource);
    const directUrl = rawSource ? sourceWithDirectiveHeaders(rawSource,directiveHeaders) : '';
    const parsedHeaders = directUrl ? parseIptvUrl(directUrl).headers : {};
    const sourceMeta = directUrl ? [{
      url:directUrl,
      originalUrl:rawSource,
      originalLabel:labelInfo.originalLabel,
      baseName:labelInfo.baseName,
      hints:[...labelInfo.hints],
      roleHint:labelInfo.roleHint,
      providerHint:labelInfo.providerHint,
      wrapperHint:labelInfo.wrapperHint,
      originalTvgId:rawId,
      requiredHeaders:{...parsedHeaders},
    }] : [];
    channels.push({
      id: normalizeId(idValue || name),
      originalId: rawId || name,
      name,
      logo,
      group,
      directUrls: directUrl ? [directUrl] : [],
      sourceMeta,
      identitySource,
      sourceTrust: 'temporary',
    });
  }
  return dedupeChannels(channels);
}

export function dedupeChannels(channels = []) {
  const map = new Map();
  for (const channel of channels) {
    const key = normalizeId(channel.id || channel.originalId || channel.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, {
      ...channel,
      id: key,
      directUrls: [...(channel.directUrls || [])],
      sourceMeta: mergeSourceMeta([],channel.sourceMeta||[]),
    });
    else {
      const current = map.get(key);
      current.directUrls = [...new Set([...(current.directUrls || []), ...(channel.directUrls || [])])];
      current.sourceMeta = mergeSourceMeta(current.sourceMeta||[],channel.sourceMeta||[]);
      if(current.identitySource!=='canonical'&&channel.identitySource==='canonical')current.identitySource='canonical';
      if (!current.logo && channel.logo) current.logo = channel.logo;
      if ((!current.group || current.group === 'Other') && channel.group) current.group = channel.group;
    }
  }
  return [...map.values()];
}
