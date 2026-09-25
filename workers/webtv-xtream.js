const VERSION = '1.4';
const DEFAULT_REGISTRY_URL = 'https://webtv-registry.atonis.workers.dev';

function cors(origin = '*') {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-webtv-session',
    'access-control-max-age': '86400',
  };
}

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clean(value = '') { return String(value ?? '').trim(); }

function requestOrigin(request, env) {
  const allowed = clean(env.ALLOWED_ORIGIN);
  if (!allowed || allowed === '*') return '*';
  const origin = request.headers.get('origin') || '';
  return origin === allowed ? origin : allowed;
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value) {
  const s = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i += 1) x |= a[i] ^ b[i];
  return x === 0;
}

async function requireAdmin(request, env, origin) {
  const customToken = clean(request.headers.get('x-webtv-session'));
  const auth = request.headers.get('authorization') || '';
  const bearerToken = auth.replace(/^Bearer\s+/i, '').trim();
  const token = customToken || bearerToken;
  if (!token) return json({ error: 'Trusted-device session required', authDebug: 'missing-session-header' }, 401, origin);

  const registry = clean(env.REGISTRY_URL) || DEFAULT_REGISTRY_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${registry.replace(/\/+$/, '')}/api/session/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return json({ error: 'Trusted-device session required', authDebug: 'registry-rejected-session' }, 401, origin);
    return null;
  } catch {
    return json({ error: 'Registry session validation unavailable' }, 503, origin);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeServer(value = '') {
  const parsed = new URL(clean(value));
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Xtream server must use http/https');
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/+$/, '');
}

function endpoint(server, path) {
  return new URL(path.replace(/^\//, ''), `${normalizeServer(server)}/`).href;
}

function encryptionSecret(env) {
  const secret = String(env.XTREAM_ENCRYPTION_KEY || '');
  if (secret.length < 24) throw new Error('XTREAM_ENCRYPTION_KEY must be configured as a Cloudflare secret');
  return secret;
}

async function encryptionKey(env) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptionSecret(env)));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptText(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(value))));
  return `${b64url(iv)}.${b64url(ciphertext)}`;
}

async function decryptText(value, env) {
  const [ivRaw, dataRaw] = String(value || '').split('.');
  if (!ivRaw || !dataRaw) throw new Error('Encrypted Xtream credential is invalid');
  const key = await encryptionKey(env);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(ivRaw) }, key, fromB64url(dataRaw));
  return new TextDecoder().decode(plain);
}

async function playbackSignature(env, accountId, streamId) {
  const sig = await hmac(encryptionSecret(env), `xtream-playback:v1:${accountId}:${streamId}`);
  return b64url(sig).slice(0, 32);
}

async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS xtream_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server TEXT NOT NULL,
    username_enc TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function providerJson(server, username, password, action = '') {
  const url = new URL(endpoint(server, '/player_api.php'));
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  if (action) url.searchParams.set('action', action);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 WebTV-V2 Xtream Bridge' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Xtream provider HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function validateAccount(server, username, password) {
  const data = await providerJson(server, username, password);
  const user = data?.user_info || {};
  const authenticated = String(user.auth ?? '') === '1' || String(user.status || '').toLowerCase() === 'active';
  if (!authenticated) throw new Error('Xtream login rejected by provider');
  const allowed = Array.isArray(user.allowed_output_formats) ? user.allowed_output_formats : [];
  return {
    status: user.status || 'Active',
    expiresAt: Number(user.exp_date || 0) || null,
    maxConnections: Number(user.max_connections || 0) || null,
    activeConnections: Number(user.active_cons || 0) || null,
    allowedOutputFormats: allowed,
  };
}

async function listAccounts(env) {
  await ensureTable(env);
  const result = await env.DB.prepare(`SELECT id,name,server,created_at AS createdAt,updated_at AS updatedAt FROM xtream_accounts ORDER BY name COLLATE NOCASE ASC`).all();
  return result.results || [];
}

async function getAccount(env, id) {
  await ensureTable(env);
  return env.DB.prepare(`SELECT id,name,server,username_enc AS usernameEnc,password_enc AS passwordEnc,created_at AS createdAt,updated_at AS updatedAt FROM xtream_accounts WHERE id=?`).bind(id).first();
}

async function saveAccount(env, payload) {
  await ensureTable(env);
  const server = normalizeServer(payload.server);
  const username = clean(payload.username);
  const password = String(payload.password || '');
  if (!username || !password) throw new Error('Username and password are required');
  const tested = await validateAccount(server, username, password);
  const id = clean(payload.id) || `xt_${crypto.randomUUID()}`;
  const name = clean(payload.name) || new URL(server).host;
  const usernameEnc = await encryptText(username, env);
  const passwordEnc = await encryptText(password, env);
  await env.DB.prepare(`INSERT INTO xtream_accounts(id,name,server,username_enc,password_enc,created_at,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,server=excluded.server,username_enc=excluded.username_enc,password_enc=excluded.password_enc,updated_at=CURRENT_TIMESTAMP`)
    .bind(id, name, server, usernameEnc, passwordEnc).run();
  return { id, name, server, tested };
}

async function deleteAccount(env, id) {
  await ensureTable(env);
  await env.DB.prepare(`DELETE FROM xtream_accounts WHERE id=?`).bind(id).run();
}

async function accountCredentials(env, row) {
  return {
    username: await decryptText(row.usernameEnc, env),
    password: await decryptText(row.passwordEnc, env),
  };
}

async function buildPlaybackUrl(requestUrl, env, accountId, streamId) {
  const url = new URL(requestUrl);
  const sig = await playbackSignature(env, accountId, streamId);
  return `${url.origin}/stream/${encodeURIComponent(accountId)}/${encodeURIComponent(streamId)}.m3u8?s=${encodeURIComponent(sig)}`;
}

async function channelsForAccount(request, env, account) {
  const creds = await accountCredentials(env, account);
  const [categories, streams] = await Promise.all([
    providerJson(account.server, creds.username, creds.password, 'get_live_categories'),
    providerJson(account.server, creds.username, creds.password, 'get_live_streams'),
  ]);
  const categoryMap = new Map((Array.isArray(categories) ? categories : []).map(c => [String(c.category_id), clean(c.category_name) || 'Xtream']));
  const rows = Array.isArray(streams) ? streams : [];
  return Promise.all(rows.map(async stream => {
    const streamId = String(stream.stream_id ?? '').trim();
    if (!streamId) return null;
    return {
      id: `xtream:${account.id}:${streamId}`,
      streamId,
      tvgId: clean(stream.epg_channel_id || stream.tv_archive_id || stream.name || streamId),
      name: clean(stream.name) || `Stream ${streamId}`,
      logo: clean(stream.stream_icon),
      group: categoryMap.get(String(stream.category_id)) || 'Xtream',
      categoryId: String(stream.category_id ?? ''),
      playbackUrl: await buildPlaybackUrl(request.url, env, account.id, streamId),
    };
  })).then(items => items.filter(Boolean));
}

async function streamRedirect(request, env, accountId, streamId, origin) {
  const account = await getAccount(env, accountId);
  if (!account) return json({ error: 'Xtream account not found' }, 404, origin);
  const supplied = fromB64url(new URL(request.url).searchParams.get('s') || '');
  const expected = fromB64url(await playbackSignature(env, accountId, streamId));
  if (!safeEqual(supplied, expected)) return json({ error: 'Invalid playback signature' }, 403, origin);
  const creds = await accountCredentials(env, account);
  const upstream = `${account.server}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(streamId)}.m3u8`;
  return Response.redirect(upstream, 302);
}

export default {
  async fetch(request, env) {
    const origin = requestOrigin(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (!env.DB) return json({ error: 'D1 binding DB is not configured' }, 503, origin);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/' || path === '/api/status') {
        await ensureTable(env);
        const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM xtream_accounts`).first();
        return json({ ok: true, service: 'WebTV Xtream Bridge', version: VERSION, accounts: Number(row?.n || 0), registryUrl: clean(env.REGISTRY_URL) || DEFAULT_REGISTRY_URL }, 200, origin);
      }

      const streamMatch = path.match(/^\/stream\/([^/]+)\/([^/]+)\.m3u8$/);
      if (streamMatch && request.method === 'GET') {
        return streamRedirect(request, env, decodeURIComponent(streamMatch[1]), decodeURIComponent(streamMatch[2]), origin);
      }

      if (path === '/api/accounts' && request.method === 'GET') {
        const denied = await requireAdmin(request, env, origin); if (denied) return denied;
        return json({ accounts: await listAccounts(env) }, 200, origin);
      }

      if (path === '/api/accounts' && request.method === 'POST') {
        const denied = await requireAdmin(request, env, origin); if (denied) return denied;
        const payload = await request.json();
        return json({ ok: true, account: await saveAccount(env, payload) }, 200, origin);
      }

      const channelsMatch = path.match(/^\/api\/accounts\/([^/]+)\/channels$/);
      if (channelsMatch && request.method === 'GET') {
        const denied = await requireAdmin(request, env, origin); if (denied) return denied;
        const account = await getAccount(env, decodeURIComponent(channelsMatch[1]));
        if (!account) return json({ error: 'Xtream account not found' }, 404, origin);
        const channels = await channelsForAccount(request, env, account);
        return json({ account: { id: account.id, name: account.name, server: account.server }, channels }, 200, origin);
      }

      const accountMatch = path.match(/^\/api\/accounts\/([^/]+)$/);
      if (accountMatch && request.method === 'DELETE') {
        const denied = await requireAdmin(request, env, origin); if (denied) return denied;
        const id = decodeURIComponent(accountMatch[1]);
        await deleteAccount(env, id);
        return json({ ok: true, id }, 200, origin);
      }

      return json({ error: 'Not found' }, 404, origin);
    } catch (error) {
      return json({ error: error?.message || String(error) }, 500, origin);
    }
  },
};