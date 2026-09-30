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

export function parseEnigma2Bouquet(text = '') {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let name = '';
  const services = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!name && /^#NAME\b/i.test(line)) {
      name = line.replace(/^#NAME\s*/i, '').trim();
      continue;
    }
    if (!line.startsWith('#SERVICE ')) continue;

    const rawBody = line.slice(9).trim();
    const parts = rawBody.split(':');
    if (parts.length < 11) continue;

    const serviceType = String(parts[0] || '').trim();
    const rawReference = String(parts[10] || '').trim();
    if (!serviceType || !rawReference) continue;

    const next = lines[i + 1]?.trim() || '';
    const hasDescription = /^#DESCRIPTION\s+/i.test(next);
    const inlineName = decodeRepeated(parts.slice(11).join(':')).trim();

    services.push({
      lineIndex: i,
      rawService: line,
      serviceType,
      rawReference,
      decodedReferenceOnce: decodeOnce(rawReference).trim(),
      decodedReference: decodeRepeated(rawReference).trim(),
      inlineName,
      description: hasDescription ? decodeRepeated(next.replace(/^#DESCRIPTION\s+/i, '')).trim() : '',
      descriptionLineIndex: hasDescription ? i + 1 : null,
    });
  }

  return { name, services };
}
