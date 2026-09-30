import { normalizeId } from './utils.js?v=20260920-1021';
import { parseM3uContainer } from './m3u-container.js?v=20260930-m3u-container-e2';

export function parseM3U(text = '') {
  const channels = [];
  for (const entry of parseM3uContainer(text)) {
    if (!entry.extinf.startsWith('#EXTINF')) continue;
    const fallbackName = entry.title || '';
    const id = entry.attributes['tvg-id'] || entry.attributes['tvg-name'] || fallbackName;
    const name = entry.attributes['tvg-name'] || fallbackName || id || 'Unknown';
    const logo = entry.attributes['tvg-logo'] || '';
    const group = entry.attributes['group-title'] || 'Other';
    const directUrl = (entry.sourceCandidates || []).find(candidate => /^https?:\/\//i.test(candidate.line || ''))?.line || '';
    channels.push({
      id: normalizeId(id || name),
      originalId: id || name,
      name,
      logo,
      group,
      directUrls: directUrl ? [directUrl] : [],
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
    if (!map.has(key)) map.set(key, { ...channel, id: key, directUrls: [...(channel.directUrls || [])] });
    else {
      const current = map.get(key);
      current.directUrls = [...new Set([...(current.directUrls || []), ...(channel.directUrls || [])])];
      if (!current.logo && channel.logo) current.logo = channel.logo;
      if ((!current.group || current.group === 'Other') && channel.group) current.group = channel.group;
    }
  }
  return [...map.values()];
}
