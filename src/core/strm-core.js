function rawReference(value = '') {
  return String(value || '').trim().split('|', 1)[0].trim();
}

export function canonicalizeStrmReference(value = '') {
  const raw = rawReference(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return '';
    if (url.hostname.toLowerCase() === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[2] === 'blob' && parts.length > 4) {
        const [owner, repo] = parts;
        const ref = parts[3];
        const path = parts.slice(4).join('/');
        return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
      }
    }
    return url.href;
  } catch {
    return '';
  }
}

export function isStrmReference(value = '') {
  const canonical = canonicalizeStrmReference(value);
  if (!canonical) return false;
  try {
    return /\.strm$/i.test(new URL(canonical).pathname);
  } catch {
    return false;
  }
}

export function parseKodiHeaderSuffix(value = '') {
  const raw = String(value || '');
  const index = raw.indexOf('|');
  if (index < 0) return {};
  const suffix = raw.slice(index + 1).replace(/;/g, '&');
  const params = new URLSearchParams(suffix);
  const out = {};
  for (const [rawKey, rawValue] of params) {
    const key = String(rawKey || '').trim().toLowerCase();
    const text = String(rawValue || '').trim();
    if (!text || /[\r\n\0]/.test(text)) continue;
    if (key === 'user-agent' || key === 'user_agent' || key === 'useragent') out['User-Agent'] = text;
    else if (key === 'referer' || key === 'referrer') out.Referer = text;
    else if (key === 'origin') out.Origin = text;
  }
  return out;
}

export function parseStrmDocument(text = '') {
  let mediaUrl = '';
  let licenseType = '';
  let licenseKey = '';
  const directives = [];
  const valueLines = [];

  for (const rawLine of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      directives.push(line);
      const prop = line.match(/^#KODIPROP:([^=]+)=(.*)$/i);
      if (prop) {
        const key = prop[1].trim().toLowerCase();
        const value = prop[2].trim();
        if (key === 'inputstream.adaptive.license_type') licenseType = value;
        if (key === 'inputstream.adaptive.license_key') licenseKey = value;
      }
      continue;
    }
    valueLines.push(line);
    if (!mediaUrl && /^https?:\/\//i.test(line)) mediaUrl = line;
  }

  return {
    mediaUrl,
    requiredHeaders: parseKodiHeaderSuffix(mediaUrl),
    drm: {
      detected: Boolean(licenseType || licenseKey),
      licenseType,
      licenseKey,
    },
    directives,
    valueLines,
  };
}
