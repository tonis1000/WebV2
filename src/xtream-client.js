const REGISTRY_TOKEN_KEY = 'webtv_v2_registry_token';
const XTREAM_BRIDGE_URL_KEY = 'webtv_v2_xtream_bridge_url';
const DEFAULT_XTREAM_BRIDGE = 'https://webtv-xtream.atonis.workers.dev';

function cleanBaseUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new URL(raw);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Xtream bridge must use http/https');
  return raw.replace(/\/+$/, '');
}

export function xtreamBridgeUrl() {
  try {
    return cleanBaseUrl(localStorage.getItem(XTREAM_BRIDGE_URL_KEY) || DEFAULT_XTREAM_BRIDGE);
  } catch {
    return DEFAULT_XTREAM_BRIDGE;
  }
}

export function setXtreamBridgeUrl(value) {
  const normalized = cleanBaseUrl(value);
  localStorage.setItem(XTREAM_BRIDGE_URL_KEY, normalized);
  return normalized;
}

function registryToken() {
  try { return localStorage.getItem(REGISTRY_TOKEN_KEY) || ''; }
  catch { return ''; }
}

async function ensureTrustedSession() {
  const auth = window.WebTVRegistryAuth;
  if (auth?.ensureSession) {
    const ok = await auth.ensureSession({ interactive: true });
    if (!ok) throw new Error('Trusted-device session is required');
  } else if (!registryToken()) {
    throw new Error('Trusted-device session is required');
  }

  const token = registryToken();
  if (!token) throw new Error('Trusted-device session is required');
  return token;
}

async function bridgeFetch(path, options = {}, { timeoutMs = 15000, requireAuth = true, json = false } = {}) {
  const token = requireAuth ? await ensureTrustedSession() : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(options.headers || {});
    if (json && !headers.has('content-type')) headers.set('content-type', 'application/json');
    if (token) {
      headers.set('x-webtv-session', token);
      headers.set('authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${xtreamBridgeUrl()}${path}`, {
      cache: 'no-store',
      ...options,
      headers,
      signal: controller.signal,
    });
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const detail = body.authDebug ? ` · ${body.authDebug}` : '';
      throw new Error((body.error || `Xtream bridge HTTP ${response.status}`) + detail);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function listXtreamAccounts() {
  const result = await bridgeFetch('/api/accounts');
  return Array.isArray(result.accounts) ? result.accounts : [];
}

export async function saveXtreamAccount({ id = '', name = '', server = '', username = '', password = '' } = {}) {
  if (!server || !username || !password) throw new Error('Server, username and password are required');
  const result = await bridgeFetch('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({ id, name, server, username, password }),
  }, { timeoutMs: 20000, json: true });
  return result.account;
}

export async function previewXtreamAccount({ name = '', server = '', username = '', password = '' } = {}) {
  if (!server || !username || !password) throw new Error('Server, username and password are required');
  const result = await bridgeFetch('/api/preview', {
    method: 'POST',
    body: JSON.stringify({ name, server, username, password }),
  }, { timeoutMs: 30000, json: true });
  return {
    previewToken: String(result.previewToken || ''),
    expiresAt: String(result.expiresAt || ''),
    account: result.account || null,
    channels: Array.isArray(result.channels) ? result.channels : [],
  };
}

export async function saveXtreamAccountFromPreview(previewToken, { name = '' } = {}) {
  if (!previewToken) throw new Error('Xtream preview token is required');
  const result = await bridgeFetch('/api/accounts/from-preview', {
    method: 'POST',
    body: JSON.stringify({ previewToken, name }),
  }, { timeoutMs: 25000, json: true });
  return result.account;
}

export async function saveXtreamChannelFromPreview(previewToken, streamId, { name = '' } = {}) {
  if (!previewToken || !streamId) throw new Error('Xtream preview token and stream ID are required');
  const result = await bridgeFetch('/api/channel-sources', {
    method: 'POST',
    body: JSON.stringify({ previewToken, streamId, name }),
  }, { timeoutMs: 25000, json: true });
  return result.source;
}

export async function deleteXtreamAccount(id) {
  if (!id) return;
  await bridgeFetch(`/api/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function loadXtreamChannels(accountId) {
  if (!accountId) throw new Error('Choose an Xtream account');
  const result = await bridgeFetch(`/api/accounts/${encodeURIComponent(accountId)}/channels`, {}, { timeoutMs: 25000 });
  return {
    account: result.account || null,
    channels: Array.isArray(result.channels) ? result.channels : [],
  };
}

function escAttr(value = '') {
  return String(value || '').replace(/"/g, "'").replace(/[\r\n]/g, ' ').trim();
}

export function xtreamChannelsToM3U(channels = [], account = {}) {
  const lines = ['#EXTM3U'];
  for (const channel of channels) {
    const url = String(channel.playbackUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const id = escAttr(channel.tvgId || channel.id || channel.streamId || channel.name);
    const name = escAttr(channel.name || id || 'Unknown');
    const logo = escAttr(channel.logo || '');
    const group = escAttr(channel.group || channel.categoryName || account.name || 'Xtream');
    lines.push(`#EXTINF:-1 tvg-id="${id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}`);
    lines.push(url);
  }
  return `${lines.join('\n')}\n`;
}

export function summarizeXtreamChannels(channels = []) {
  const groups = new Set(channels.map(channel => channel.group || channel.categoryName || 'Xtream'));
  return {
    count: channels.length,
    groups: groups.size,
    sample: channels.slice(0, 8).map(channel => channel.name),
  };
}

export const XTREAM_DEFAULT_BRIDGE = DEFAULT_XTREAM_BRIDGE;
