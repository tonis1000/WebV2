const CAPABILITY_KEYS = Object.freeze([
  'browserPlayback',
  'verifierProbe',
  'requiresResolver',
  'container',
  'credentialed',
  'live',
  'vod',
]);

const EMPTY_CAPABILITIES = Object.freeze({
  browserPlayback: false,
  verifierProbe: false,
  requiresResolver: false,
  container: false,
  credentialed: false,
  live: false,
  vod: false,
});

function normalizeCapabilities(input = {}) {
  const out = {};
  for (const key of CAPABILITY_KEYS) out[key] = Boolean(input?.[key]);
  return Object.freeze(out);
}

export function normalizeSourceDescriptor(input = {}) {
  const id = String(input.id || '').trim().toLowerCase();
  if (!id) throw new Error('Source format descriptor id is required');
  const aliases = [...new Set((Array.isArray(input.aliases) ? input.aliases : [])
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
  const descriptor = {
    id,
    aliases: Object.freeze(aliases),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    detectUrl: typeof input.detectUrl === 'function' ? input.detectUrl : () => false,
    detectBody: typeof input.detectBody === 'function' ? input.detectBody : () => false,
    capabilities: normalizeCapabilities(input.capabilities || EMPTY_CAPABILITIES),
    verificationMode: String(input.verificationMode || 'unsupported'),
    resolutionMode: String(input.resolutionMode || 'none'),
    savePolicy: String(input.savePolicy || 'inspect-only'),
    compatibilityType: String(input.compatibilityType || id).trim().toLowerCase() || id,
  };
  return Object.freeze(descriptor);
}

export function createSourceFormatRegistry(descriptors = []) {
  const normalized = descriptors.map(normalizeSourceDescriptor);
  const ids = new Set();
  const names = new Set();
  for (const descriptor of normalized) {
    if (ids.has(descriptor.id)) throw new Error(`Duplicate source format id: ${descriptor.id}`);
    ids.add(descriptor.id);
    for (const name of [descriptor.id, ...descriptor.aliases]) {
      if (names.has(name)) throw new Error(`Duplicate source format name: ${name}`);
      names.add(name);
    }
  }
  normalized.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return Object.freeze(normalized);
}

function urlFacts(sourceUrl = '') {
  const raw = String(sourceUrl || '').trim().split('|', 1)[0].trim();
  if (!raw) return { sourceUrl: '', rawScheme: '', rawExtension: '', pathname: '' };
  let rawScheme = '';
  let pathname = '';
  try {
    const parsed = new URL(raw);
    rawScheme = parsed.protocol.replace(/:$/, '').toLowerCase();
    pathname = parsed.pathname || '';
  } catch {
    rawScheme = (raw.match(/^([a-z][a-z0-9+.-]*):/i)?.[1] || '').toLowerCase();
    pathname = raw.split(/[?#]/, 1)[0];
  }
  const leaf = pathname.split('/').pop() || '';
  const ext = leaf.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return { sourceUrl: raw, rawScheme, rawExtension: ext, pathname };
}

function descriptorByName(name, registry) {
  const key = String(name || '').trim().toLowerCase();
  if (!key || key === 'unknown') return null;
  return registry.find(item => item.id === key || item.aliases.includes(key)) || null;
}

function recognitionStatus(descriptor) {
  return descriptor?.verificationMode === 'unsupported' && ['rtsp', 'rtmp'].includes(descriptor.id)
    ? 'recognized-unsupported'
    : descriptor?.id === 'unknown'
      ? 'unknown'
      : 'recognized';
}

function classificationFromDescriptor(descriptor, facts, explicitType = '', confidence = 'high', mediaFormatId) {
  const formatId = descriptor?.id || 'unknown';
  const inferredMedia = mediaFormatId ?? (['hls', 'dash', 'direct-video'].includes(formatId) ? formatId : 'unknown');
  return Object.freeze({
    formatId,
    mediaFormatId: inferredMedia,
    status: recognitionStatus(descriptor),
    confidence,
    explicitType: String(explicitType || '').trim().toLowerCase(),
    rawScheme: facts.rawScheme,
    rawExtension: facts.rawExtension,
    capabilities: descriptor?.capabilities || EMPTY_CAPABILITIES,
    verificationMode: descriptor?.verificationMode || 'unsupported',
    resolutionMode: descriptor?.resolutionMode || 'none',
    savePolicy: descriptor?.savePolicy || 'inspect-only',
  });
}

function matchesBodyResult(result) {
  if (result === true) return true;
  if (!result || typeof result !== 'object') return false;
  return result.match !== false;
}

export function classifySourceBody(input = {}, registry = DEFAULT_SOURCE_FORMAT_REGISTRY) {
  const contentType = String(input.contentType || '').trim().toLowerCase();
  const body = String(input.body || '');
  for (const descriptor of registry) {
    if (descriptor.id === 'unknown' || descriptor.id === 'http-resource') continue;
    let result = false;
    try { result = descriptor.detectBody({ ...input, contentType, body }); } catch { result = false; }
    if (!matchesBodyResult(result)) continue;
    return Object.freeze({
      formatId: descriptor.id,
      mediaFormatId: ['hls', 'dash', 'direct-video'].includes(descriptor.id) ? descriptor.id : 'unknown',
      status: recognitionStatus(descriptor),
      confidence: 'body',
      capabilities: descriptor.capabilities,
      verificationMode: descriptor.verificationMode,
      resolutionMode: descriptor.resolutionMode,
      savePolicy: descriptor.savePolicy,
    });
  }
  return Object.freeze({
    formatId: 'unknown',
    mediaFormatId: 'unknown',
    status: 'unknown',
    confidence: 'none',
    capabilities: EMPTY_CAPABILITIES,
    verificationMode: 'unsupported',
    resolutionMode: 'none',
    savePolicy: 'inspect-only',
  });
}

export function detectSourceFormat(input = {}, registry = DEFAULT_SOURCE_FORMAT_REGISTRY) {
  const facts = urlFacts(input.sourceUrl);
  const explicit = descriptorByName(input.explicitType, registry);
  if (explicit) return classificationFromDescriptor(explicit, facts, input.explicitType, 'explicit');

  for (const descriptor of registry) {
    if (descriptor.id === 'unknown') continue;
    let matched = false;
    try { matched = Boolean(descriptor.detectUrl({ ...input, ...facts })); } catch { matched = false; }
    if (!matched) continue;
    const base = classificationFromDescriptor(
      descriptor,
      facts,
      input.explicitType,
      descriptor.id === 'http-resource' ? 'transport-only' : 'high',
    );
    if (descriptor.id === 'http-resource' && (input.body || input.contentType)) {
      const bodyClass = classifySourceBody(input, registry);
      if (bodyClass.mediaFormatId !== 'unknown') {
        return Object.freeze({ ...base, mediaFormatId: bodyClass.mediaFormatId, confidence: 'body' });
      }
    }
    return base;
  }

  const unknown = getSourceFormat('unknown', registry) || normalizeSourceDescriptor({ id: 'unknown' });
  return classificationFromDescriptor(unknown, facts, input.explicitType, 'none', 'unknown');
}

export function getSourceFormat(id, registry = DEFAULT_SOURCE_FORMAT_REGISTRY) {
  const key = String(id || '').trim().toLowerCase();
  return registry.find(item => item.id === key || item.aliases.includes(key)) || null;
}

export function listSourceFormats(registry = DEFAULT_SOURCE_FORMAT_REGISTRY) {
  return [...registry];
}

export function toLegacySourceType(classification = {}, registry = DEFAULT_SOURCE_FORMAT_REGISTRY) {
  const descriptor = getSourceFormat(classification.formatId, registry);
  return descriptor?.compatibilityType || 'unknown';
}

const descriptors = [
  {
    id: 'hls', aliases: [], priority: 100,
    detectUrl: ({ pathname }) => /\.m3u8$/i.test(pathname || ''),
    detectBody: ({ body, contentType }) => String(body || '').trimStart().startsWith('#EXTM3U') && (String(body).includes('#EXT-X-') || /mpegurl/i.test(contentType || '')) || /mpegurl/i.test(contentType || ''),
    capabilities: { browserPlayback: true, verifierProbe: true, requiresResolver: false, container: false, credentialed: false, live: true, vod: true },
    verificationMode: 'manifest', resolutionMode: 'none', savePolicy: 'saveable', compatibilityType: 'hls',
  },
  {
    id: 'dash', aliases: [], priority: 95,
    detectUrl: ({ pathname }) => /\.mpd$/i.test(pathname || ''),
    detectBody: ({ body, contentType }) => /<MPD\b/i.test(String(body || '')) || /dash\+xml/i.test(contentType || ''),
    capabilities: { browserPlayback: true, verifierProbe: true, requiresResolver: false, container: false, credentialed: false, live: true, vod: true },
    verificationMode: 'manifest', resolutionMode: 'none', savePolicy: 'saveable', compatibilityType: 'dash',
  },
  {
    id: 'direct-video', aliases: ['direct-media'], priority: 90,
    detectUrl: ({ pathname }) => /\.(mp4|webm)$/i.test(pathname || ''),
    detectBody: ({ contentType }) => /^(video|audio)\//i.test(contentType || '') || /octet-stream/i.test(contentType || ''),
    capabilities: { browserPlayback: true, verifierProbe: true, requiresResolver: false, container: false, credentialed: false, live: false, vod: true },
    verificationMode: 'direct-media', resolutionMode: 'none', savePolicy: 'saveable', compatibilityType: 'direct',
  },
  {
    id: 'strm', aliases: [], priority: 85,
    detectUrl: ({ pathname }) => /\.strm$/i.test(pathname || ''), detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: true, credentialed: false, live: true, vod: true },
    verificationMode: 'resolve-first', resolutionMode: 'strm', savePolicy: 'resolve-first', compatibilityType: 'strm',
  },
  {
    id: 'm3u', aliases: [], priority: 80,
    detectUrl: ({ pathname }) => /\.m3u$/i.test(pathname || ''),
    detectBody: ({ body }) => String(body || '').trimStart().startsWith('#EXTM3U') && !String(body || '').includes('#EXT-X-'),
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: true, credentialed: false, live: true, vod: true },
    verificationMode: 'resolve-first', resolutionMode: 'container', savePolicy: 'resolve-first', compatibilityType: 'm3u',
  },
  {
    id: 'rtsp', aliases: ['rtsps'], priority: 75,
    detectUrl: ({ rawScheme }) => rawScheme === 'rtsp' || rawScheme === 'rtsps', detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: false, credentialed: false, live: true, vod: false },
    verificationMode: 'unsupported', resolutionMode: 'external', savePolicy: 'inspect-only', compatibilityType: 'rtsp',
  },
  {
    id: 'rtmp', aliases: ['rtmps'], priority: 70,
    detectUrl: ({ rawScheme }) => rawScheme === 'rtmp' || rawScheme === 'rtmps', detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: false, credentialed: false, live: true, vod: false },
    verificationMode: 'unsupported', resolutionMode: 'external', savePolicy: 'inspect-only', compatibilityType: 'rtmp',
  },
  {
    id: 'xtream', aliases: [], priority: 60,
    detectUrl: () => false, detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: false, requiresResolver: true, container: false, credentialed: true, live: true, vod: true },
    verificationMode: 'external-contract', resolutionMode: 'xtream', savePolicy: 'context-only', compatibilityType: 'xtream',
  },
  {
    id: 'header-aware', aliases: [], priority: 55,
    detectUrl: () => false, detectBody: () => false,
    capabilities: { browserPlayback: true, verifierProbe: true, requiresResolver: false, container: false, credentialed: false, live: true, vod: true },
    verificationMode: 'transport-probe', resolutionMode: 'none', savePolicy: 'saveable', compatibilityType: 'header-aware',
  },
  {
    id: 'http-resource', aliases: ['direct'], priority: 10,
    detectUrl: ({ rawScheme }) => rawScheme === 'http' || rawScheme === 'https', detectBody: () => false,
    capabilities: { browserPlayback: false, verifierProbe: true, requiresResolver: false, container: false, credentialed: false, live: false, vod: false },
    verificationMode: 'transport-probe', resolutionMode: 'none', savePolicy: 'saveable', compatibilityType: 'direct',
  },
  {
    id: 'unknown', aliases: [], priority: -1000,
    detectUrl: () => false, detectBody: () => false,
    capabilities: EMPTY_CAPABILITIES,
    verificationMode: 'unsupported', resolutionMode: 'none', savePolicy: 'inspect-only', compatibilityType: 'unknown',
  },
];

export const DEFAULT_SOURCE_FORMAT_REGISTRY = createSourceFormatRegistry(descriptors);
