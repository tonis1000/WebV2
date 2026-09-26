const SOURCE_TYPES = new Set(['hls','dash','strm','m3u','direct','xtream','header-aware','unknown']);
const MATCH_CONFIDENCE = new Set(['HIGH','MEDIUM','LOW','UNKNOWN']);
const VERIFICATION_STATES = new Set(['UNVERIFIED','VERIFIED','FAILED','TIMEOUT','HTTP 403','HTTP 404','DRM','WRONG CHANNEL','UNRESOLVED']);

export function normalizeChannelName(value='') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function detectCandidateType(sourceUrl='', explicitType='') {
  const requested=String(explicitType||'').toLowerCase();
  if (SOURCE_TYPES.has(requested) && requested !== 'unknown') return requested;
  const url=String(sourceUrl||'').split('|')[0].trim().toLowerCase();
  if (!url) return 'unknown';
  if (/\.strm(?:[?#]|$)/i.test(url)) return 'strm';
  if (/\.mpd(?:[?#]|$)/i.test(url)) return 'dash';
  if (/\.m3u8(?:[?#]|$)/i.test(url)) return 'hls';
  if (/\.m3u(?:[?#]|$)/i.test(url)) return 'm3u';
  return 'direct';
}

function stableId(parts=[]) {
  let hash=2166136261;
  for (const ch of parts.join('|')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cand_${(hash>>>0).toString(36)}`;
}

function cleanHeaders(headers={}) {
  if (!headers || typeof headers !== 'object') return {};
  const allowed=new Set(['User-Agent','Referer','Origin']);
  const out={};
  for (const [key,value] of Object.entries(headers)) {
    const canonical=[...allowed].find(item=>item.toLowerCase()===String(key).toLowerCase());
    if (!canonical) continue;
    const text=String(value||'').trim();
    if (text && !/[\r\n\0]/.test(text)) out[canonical]=text;
  }
  return out;
}

export function createCandidate(input={}) {
  const channelName=String(input.channelName||'').trim();
  const sourceUrl=String(input.sourceUrl||'').trim();
  const sourceType=input.xtreamContext ? 'xtream' : detectCandidateType(sourceUrl,input.sourceType);
  const verificationStatus=VERIFICATION_STATES.has(input.verificationStatus) ? input.verificationStatus : 'UNVERIFIED';
  const verified=verificationStatus === 'VERIFIED' && input.verified !== false;
  const matchConfidence=MATCH_CONFIDENCE.has(input.matchConfidence) ? input.matchConfidence : 'UNKNOWN';
  const requiredHeaders=cleanHeaders(input.requiredHeaders);
  const xtreamContext=input.xtreamContext && typeof input.xtreamContext === 'object' ? {
    server:String(input.xtreamContext.server||'').trim(),
    username:String(input.xtreamContext.username||'').trim(),
    password:String(input.xtreamContext.password||''),
    streamId:String(input.xtreamContext.streamId||input.xtreamStreamId||'').trim(),
    accountRef:String(input.xtreamContext.accountRef||input.xtreamAccountRef||'').trim(),
  } : null;
  const discoveredAt=input.discoveredAt || new Date().toISOString();
  return Object.freeze({
    candidateId:String(input.candidateId||stableId([channelName,sourceType,sourceUrl,input.sourceOrigin||'',xtreamContext?.accountRef||'',xtreamContext?.streamId||''])),
    channelName,
    normalizedChannelName:normalizeChannelName(input.normalizedChannelName||channelName),
    sourceType,
    sourceUrl,
    sourceOrigin:String(input.sourceOrigin||'local-mock'),
    discoveredAt,
    discoveryProvider:String(input.discoveryProvider||'phase1-local'),
    freshness:input.freshness ?? null,
    requiredHeaders:Object.freeze(requiredHeaders),
    xtreamAccountRef:xtreamContext?.accountRef || String(input.xtreamAccountRef||''),
    xtreamStreamId:xtreamContext?.streamId || String(input.xtreamStreamId||''),
    xtreamContext:xtreamContext ? Object.freeze(xtreamContext) : null,
    verified,
    verificationStatus,
    startupMs:Number.isFinite(Number(input.startupMs)) ? Number(input.startupMs) : null,
    lastHttpStatus:Number.isFinite(Number(input.lastHttpStatus)) ? Number(input.lastHttpStatus) : null,
    mediaType:String(input.mediaType||''),
    drmDetected:Boolean(input.drmDetected),
    healthScore:Number.isFinite(Number(input.healthScore)) ? Number(input.healthScore) : null,
    duplicateOf:input.duplicateOf || null,
    matchConfidence,
  });
}

export function candidateForDisplay(candidate={}) {
  const { xtreamContext, ...rest } = candidate;
  return {
    ...rest,
    xtreamContext:xtreamContext ? {
      server:xtreamContext.server,
      username:xtreamContext.username,
      password:xtreamContext.password ? '••••••••' : '',
      streamId:xtreamContext.streamId,
      accountRef:xtreamContext.accountRef,
    } : null,
  };
}

export { SOURCE_TYPES, MATCH_CONFIDENCE, VERIFICATION_STATES };
