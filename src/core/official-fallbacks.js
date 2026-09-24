import { OFFICIAL_FALLBACKS } from '../config.js?v=20260924-1115';
import { normalizeId } from './utils.js?v=20260924-0900';

const TRUSTED_EMBED_HOSTS = new Set(['www.youtube-nocookie.com']);

export function officialChannelKey(channel = {}) {
  return normalizeId(channel?.id || channel?.originalId || channel?.name || '');
}

export function isTrustedOfficialEmbedUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && TRUSTED_EMBED_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
}

export function officialFallbackFor(channel = {}) {
  const fallback = OFFICIAL_FALLBACKS[officialChannelKey(channel)] || null;
  if (!fallback) return null;
  if (!isTrustedOfficialEmbedUrl(fallback.embedUrl)) return null;
  try {
    const external = new URL(fallback.externalUrl || '');
    if (external.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return fallback;
}

export function officialDiscoveryLinks(channel = {}) {
  const name = String(channel?.name || channel?.originalId || channel?.id || '').trim();
  if (!name) return [];
  const google = query => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const youtube = query => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return [
    {
      kind: 'official-youtube',
      label: 'Official YouTube Live',
      detail: 'Official broadcaster/channel live stream on YouTube',
      url: youtube(`${name} official live Greece TV`),
    },
    {
      kind: 'official-live-page',
      label: 'Official Live Page',
      detail: 'Broadcaster-owned live page or web player',
      url: google(`"${name}" official live Greece TV`),
    },
    {
      kind: 'official-embed',
      label: 'Official Embed',
      detail: 'Official embeddable player or live stream page',
      url: google(`"${name}" official live embed Greece TV`),
    },
    {
      kind: 'official-stream',
      label: 'Official HLS / DASH',
      detail: 'Broadcaster-owned HLS or DASH endpoint',
      url: google(`"${name}" official (m3u8 OR mpd OR HLS OR DASH) Greece TV`),
    },
  ];
}
