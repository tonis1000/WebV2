import { deleteXtreamChannelSource, xtreamBridgeUrl } from './xtream-client.js?v=20260926-1800';

function cleanUrl(value = '') {
  return String(value || '').trim();
}

export function diffRemovedUrls(previousUrls = [], currentUrls = []) {
  const current = new Set((Array.isArray(currentUrls) ? currentUrls : []).map(cleanUrl).filter(Boolean));
  return [...new Set((Array.isArray(previousUrls) ? previousUrls : []).map(cleanUrl).filter(url => url && !current.has(url)))];
}

export function extractXtreamChannelSourceIds(urls = [], { bridgeBase = xtreamBridgeUrl() } = {}) {
  let bridgeOrigin = '';
  try { bridgeOrigin = new URL(bridgeBase).origin; } catch { return []; }
  const ids = new Set();
  for (const raw of Array.isArray(urls) ? urls : []) {
    try {
      const url = new URL(cleanUrl(raw));
      if (url.origin !== bridgeOrigin) continue;
      const match = url.pathname.match(/^\/channel-stream\/(xch_[A-Za-z0-9_-]{8,64})\/[^/]+\.m3u8$/);
      if (match) ids.add(match[1]);
    } catch {}
  }
  return [...ids];
}

export async function cleanupRemovedXtreamChannelSources(removedUrls = [], {
  bridgeBase = xtreamBridgeUrl(),
  deleteSource = deleteXtreamChannelSource,
} = {}) {
  const ids = extractXtreamChannelSourceIds(removedUrls, { bridgeBase });
  const cleaned = [];
  const retained = [];
  const failed = [];
  for (const id of ids) {
    try {
      const result = await deleteSource(id);
      if (result?.deleted) cleaned.push(id);
      else retained.push({ id, reason: result?.reason || 'retained', references: Number(result?.references || 0) });
    } catch (error) {
      failed.push({ id, error: error?.message || String(error) });
    }
  }
  return { ids, cleaned, retained, failed };
}
