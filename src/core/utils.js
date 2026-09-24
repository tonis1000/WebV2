import { CONFIG } from '../config.js';

export function normalizeId(value = '') {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&amp;/g, '&').replace(/[΄'`´"\s|&–—-]/g, '').replace(/[^\p{L}\p{N}._:]/gu, '');
}
export function cleanUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  // IPTV/Kodi playlists often append request options such as
  // "|user-agent=...&referer=...". Browsers cannot apply those options from
  // the media URL itself, and keeping them breaks media-type detection,
  // route identity and Worker proxy URLs. Playback uses the underlying URL.
  const withoutKodiOptions = raw.split('|', 1)[0].trim();
  return withoutKodiOptions.split('#', 1)[0].trim();
}
export function isHls(url = '') { return /\.m3u8(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isDash(url = '') { return /\.mpd(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isVideoFile(url = '') { return /\.(mp4|webm)(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isEmbed(url = '') { return /(?:embed|\.php(?:\?|$)|\.html?(?:\?|$))/i.test(url); }
export function workerUrl(url) {
  const cleaned = cleanUrl(url);
  if (!cleaned) return '';
  if (cleaned.startsWith(`${CONFIG.cacheBaseUrl}/?url=`)) return cleaned;
  return `${CONFIG.cacheBaseUrl}/?url=${encodeURIComponent(cleaned)}`;
}
export async function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.requestTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
export function formatTime(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
