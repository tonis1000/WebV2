import { CONFIG } from '../config.js';

const IPTV_HEADER_ALIASES = Object.freeze({
  'user-agent': 'User-Agent',
  useragent: 'User-Agent',
  referer: 'Referer',
  referrer: 'Referer',
  origin: 'Origin',
});

const IPTV_HEADER_MAX_LENGTH = 2048;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function sanitizeHeaderValue(value = '') {
  const text = String(value ?? '').trim();
  if (!text || text.length > IPTV_HEADER_MAX_LENGTH || CONTROL_CHARS.test(text)) return '';
  return text;
}

export function normalizeIptvHeaders(headers = {}) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const key = String(rawName || '').trim().toLowerCase();
    const canonical = IPTV_HEADER_ALIASES[key];
    if (!canonical) continue;
    const value = sanitizeHeaderValue(rawValue);
    if (value) out[canonical] = value;
  }

  return out;
}

export function parseIptvUrl(rawValue = '') {
  const raw = String(rawValue || '').trim();
  if (!raw) return { url: '', headers: {} };

  const pipeIndex = raw.indexOf('|');
  const urlPart = (pipeIndex >= 0 ? raw.slice(0, pipeIndex) : raw).trim();
  const optionsPart = pipeIndex >= 0 ? raw.slice(pipeIndex + 1).trim() : '';
  const url = urlPart.split('#', 1)[0].trim();
  const headers = {};

  if (optionsPart) {
    const params = new URLSearchParams(optionsPart);
    for (const [name, value] of params.entries()) {
      const canonical = IPTV_HEADER_ALIASES[String(name || '').trim().toLowerCase()];
      if (!canonical) continue;
      const safeValue = sanitizeHeaderValue(value);
      if (safeValue) headers[canonical] = safeValue;
    }
  }

  return { url, headers };
}

export function normalizeId(value = '') {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&amp;/g, '&').replace(/[΄'`´"\s|&–—-]/g, '').replace(/[^\p{L}\p{N}._:]/gu, '');
}

export function cleanUrl(url = '') {
  return parseIptvUrl(url).url;
}

export function isHls(url = '') { return /\.m3u8(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isDash(url = '') { return /\.mpd(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isVideoFile(url = '') { return /\.(mp4|webm)(?:\?.*)?$/i.test(cleanUrl(url)); }
export function isEmbed(url = '') { return /(?:embed|\.php(?:\?|$)|\.html?(?:\?|$))/i.test(url); }

function encodeHeaderContext(headers = {}) {
  const approved = normalizeIptvHeaders(headers);
  if (!Object.keys(approved).length) return '';

  const bytes = new TextEncoder().encode(JSON.stringify(approved));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function workerUrl(url, headers = {}) {
  const cleaned = cleanUrl(url);
  if (!cleaned) return '';
  if (cleaned.startsWith(`${CONFIG.cacheBaseUrl}/?url=`) || cleaned.startsWith(`${CONFIG.cacheBaseUrl}/?h=`)) return cleaned;

  const headerContext = encodeHeaderContext(headers);
  if (!headerContext) {
    return `${CONFIG.cacheBaseUrl}/?url=${encodeURIComponent(cleaned)}`;
  }

  // Keep `url` last so existing media-type detection still sees `.m3u8`
  // at the end of the Worker playback URL.
  return `${CONFIG.cacheBaseUrl}/?h=${encodeURIComponent(headerContext)}&url=${encodeURIComponent(cleaned)}`;
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
