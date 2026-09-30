function splitExtinfPayload(line = '') {
  const text = String(line || '').trim();
  const colon = text.indexOf(':');
  const payload = colon >= 0 ? text.slice(colon + 1) : '';
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < payload.length; i += 1) {
    const ch = payload[i];
    if ((ch === '"' || ch === "'") && (!inQuote || ch === quoteChar)) {
      if (inQuote) { inQuote = false; quoteChar = ''; }
      else { inQuote = true; quoteChar = ch; }
      continue;
    }
    if (ch === ',' && !inQuote) return { metadata: payload.slice(0, i).trim(), title: payload.slice(i + 1).trim() };
  }
  return { metadata: payload.trim(), title: '' };
}

export function parseM3uAttributes(extinfLine = '') {
  const { metadata } = splitExtinfPayload(extinfLine);
  const attrs = {};
  const durationMatch = metadata.match(/^([^\s]+)/);
  const start = durationMatch ? durationMatch[0].length : 0;
  const rest = metadata.slice(start).trim();
  const re = /([A-Za-z0-9_.:-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  for (const match of rest.matchAll(re)) {
    attrs[match[1].toLowerCase()] = String(match[2] ?? match[3] ?? match[4] ?? '').trim();
  }
  return attrs;
}

export function isM3uContainer(text = '') {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
  return lines.some(line => /^#EXTM3U\b/i.test(line) || /^#EXTINF\s*:/i.test(line));
}

function parseDuration(extinf = '') {
  const { metadata } = splitExtinfPayload(extinf);
  const token = metadata.match(/^([^\s]+)/)?.[1] || '';
  if (!token) return null;
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}

export function parseM3uContainer(text = '') {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const extinf = lines[i].trim();
    if (!/^#EXTINF\s*:/i.test(extinf)) continue;

    const directivesBeforeSource = [];
    let sourceLine = '';
    let sourceOffset = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next) continue;
      if (/^#EXTINF\s*:/i.test(next)) break;
      if (next.startsWith('#')) {
        directivesBeforeSource.push(next);
        continue;
      }
      sourceLine = next;
      sourceOffset = j - i;
      break;
    }

    const { title } = splitExtinfPayload(extinf);
    entries.push({
      index: entries.length,
      extinf,
      duration: parseDuration(extinf),
      title,
      attributes: parseM3uAttributes(extinf),
      sourceLine,
      sourceOffset,
      directivesBeforeSource,
    });
  }
  return entries;
}
