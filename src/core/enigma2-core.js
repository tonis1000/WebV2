function decodeOnce(value = '') {
  const raw = String(value || '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw
      .replace(/%3a/ig, ':')
      .replace(/%2f/ig, '/')
      .replace(/%7c/ig, '|')
      .replace(/%20/ig, ' ');
  }
}

function decodeRepeated(value = '', rounds = 2) {
  let out = String(value || '');
  for (let i = 0; i < rounds; i++) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.replace(/%25/gi, '%');
}

function embeddedReferenceFacts(rawBody = '') {
  const raw = String(rawBody || '');
  const schemeMatch = raw.match(/(?:https?|rtmp|rtsp)(?::|%3a)\/\//i);
  if (!schemeMatch) return { embeddedReference: '', embeddedInlineName: '' };

  let payload = raw.slice(schemeMatch.index);
  let rawLabel = '';
  const lastColon = payload.lastIndexOf(':');
  if (lastColon > 0) {
    rawLabel = payload.slice(lastColon + 1).trim();
    payload = payload.slice(0, lastColon);
  }

  return {
    embeddedReference: decodeRepeated(payload).trim(),
    embeddedInlineName: decodeRepeated(rawLabel).trim(),
  };
}

function serviceLabelFacts(lines, i) {
  const line = lines[i]?.trim() || '';
  if (!line.startsWith('#SERVICE ')) return null;

  const rawBody = line.slice(9).trim();
  const parts = rawBody.split(':');
  const serviceType = String(parts[0] || '').trim();
  const rawReference = parts.length >= 11 ? String(parts[10] || '').trim() : '';
  const hasEmbeddedReference = /(?:https?|rtmp|rtsp)(?::|%3a)\/\//i.test(rawBody);
  if (!serviceType || (!rawReference && !hasEmbeddedReference)) return null;

  const next = lines[i + 1]?.trim() || '';
  const hasDescription = /^#DESCRIPTION\s+/i.test(next);
  const rawInlineName = parts.length >= 11 ? parts.slice(11).join(':').trim() : '';
  const rawDescription = hasDescription ? next.replace(/^#DESCRIPTION\s+/i, '').trim() : '';

  return {
    lineIndex: i,
    rawService: line,
    rawBody,
    serviceType,
    rawReference,
    rawInlineName,
    inlineNameDecodedOnce: decodeOnce(rawInlineName).trim(),
    inlineName: decodeRepeated(rawInlineName).trim(),
    rawDescription,
    description: decodeRepeated(rawDescription).trim(),
    descriptionLineIndex: hasDescription ? i + 1 : null,
  };
}

function materializeServiceReferenceFacts(service) {
  const embedded = embeddedReferenceFacts(service.rawBody);
  if (!service.rawReference && !embedded.embeddedReference) return null;
  const { rawBody, ...base } = service;
  return {
    ...base,
    decodedReferenceOnce: decodeOnce(service.rawReference).trim(),
    decodedReference: decodeRepeated(service.rawReference).trim(),
    ...embedded,
  };
}

export function selectEnigma2BouquetServices(text = '', { acceptService = () => true, limit = Infinity } = {}) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let name = '';
  const services = [];
  const max = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!name && /^#NAME\b/i.test(line)) {
      name = line.replace(/^#NAME\s*/i, '').trim();
      continue;
    }
    if (services.length >= max) continue;

    const labels = serviceLabelFacts(lines, i);
    if (!labels || acceptService(labels) !== true) continue;
    const materialized = materializeServiceReferenceFacts(labels);
    if (materialized) services.push(materialized);
  }

  return { name, services };
}

export function parseEnigma2Bouquet(text = '') {
  return selectEnigma2BouquetServices(text);
}
