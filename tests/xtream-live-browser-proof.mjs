import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const WEBV2_URL = process.env.WEBV2_URL || 'https://tonis1000.github.io/WebV2/';
const MOCK_URL = process.env.XTREAM_MOCK_URL || 'https://webtv-xtream-mock.atonis.workers.dev';
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'artifacts/xtream-live-ui-proof';
const FAKE_TOKEN = 'ci-browser-proof-token';
const profiles = ['test_50', 'test_500', 'test_5000'];

await fs.mkdir(ARTIFACT_DIR, { recursive: true });

async function providerJson(username, action = '') {
  const url = new URL('/player_api.php', MOCK_URL);
  url.searchParams.set('username', username);
  url.searchParams.set('password', 'test_pass');
  if (action) url.searchParams.set('action', action);
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Mock provider ${username}/${action || 'login'} HTTP ${response.status}`);
  return response.json();
}

const providerCatalogs = new Map();
const liveProviderProof = {};
for (const username of profiles) {
  const [login, categories, streams] = await Promise.all([
    providerJson(username),
    providerJson(username, 'get_live_categories'),
    providerJson(username, 'get_live_streams'),
  ]);
  assert.equal(String(login?.user_info?.auth), '1', `${username} must authenticate on live mock provider`);
  const expected = Number(username.split('_')[1]);
  assert.equal(streams.length, expected, `${username} must expose ${expected} live channels`);
  assert.ok(categories.length > 0, `${username} must expose categories`);
  providerCatalogs.set(username, { categories, streams });
  liveProviderProof[username] = { channels: streams.length, categories: categories.length };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await context.addInitScript(token => {
  localStorage.setItem('webtv_v2_registry_token', token);
}, FAKE_TOKEN);

const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const writes = [];
const timings = {};
const customPlaylists = new Map();
const savedAccounts = [];
let lastMaterializedStreamId = '';
let activeUsername = '';
let nextCustomId = 1;
let playerMutationCount = 0;

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', error => pageErrors.push(error.message));
page.on('dialog', async dialog => {
  if (/Saved Xtream playlist name/i.test(dialog.message())) await dialog.accept('CI Full Account');
  else await dialog.dismiss();
});

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
function mappedCatalog(username) {
  const raw = providerCatalogs.get(username);
  assert.ok(raw, `missing prefetched live catalog for ${username}`);
  const names = new Map(raw.categories.map(item => [String(item.category_id), String(item.category_name || 'Xtream')]));
  return raw.streams.map(stream => ({
    streamId: String(stream.stream_id),
    tvgId: String(stream.epg_channel_id || stream.name || stream.stream_id),
    name: String(stream.name || `Stream ${stream.stream_id}`),
    logo: String(stream.stream_icon || ''),
    group: names.get(String(stream.category_id)) || 'Xtream',
    categoryId: String(stream.category_id || ''),
    playbackUrl: `https://webtv-xtream.atonis.workers.dev/preview-stream/${encodeURIComponent(stream.stream_id)}.m3u8?t=ci-preview-${username}`,
  }));
}
function streamForId(streamId) {
  for (const { streams } of providerCatalogs.values()) {
    const found = streams.find(item => String(item.stream_id) === String(streamId));
    if (found) return found;
  }
  return null;
}
function myPlaylistPayload() {
  const stream = streamForId(lastMaterializedStreamId);
  if (!stream) return { channels: [] };
  const id = String(stream.epg_channel_id || stream.name || stream.stream_id);
  return {
    channels: [{
      id,
      originalId: id,
      tvgId: id,
      name: String(stream.name),
      logo: String(stream.stream_icon || ''),
      groupName: 'CI known',
      sources: [{ url: `https://known.example/${encodeURIComponent(id)}.m3u8`, origin: 'ci-known', enabled: true, priority: 50 }],
    }],
  };
}

await page.route('https://webtv-registry.atonis.workers.dev/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (url.pathname === '/api/status') return json(route, { ok: true, service: 'WebTV Registry', version: '1.5', d1: true, primaryPlaylist: 'd1', pinAuth: false, pinAuthDisabled: true, sessionDays: 180, myPlaylistChannels: 13 });
  if (url.pathname === '/api/session' || url.pathname === '/api/session/validate') return json(route, { ok: true });
  if (url.pathname === '/api/my-playlist' && method === 'GET') return json(route, myPlaylistPayload());
  if (url.pathname === '/api/playlists' && method === 'GET') return json(route, { playlists: [...customPlaylists.values()] });
  if (url.pathname === '/api/playlists' && method === 'POST') {
    const body = request.postDataJSON();
    writes.push({ target: 'registry-playlists', body });
    if (body.kind === 'custom') {
      const playlist = { id: `ci_custom_${nextCustomId++}`, name: body.name, kind: 'custom', channelCount: 0, groupCount: 0 };
      customPlaylists.set(playlist.id, { ...playlist, channels: [] });
      return json(route, { ok: true, playlist }, 201);
    }
    if (body.kind === 'xtream') {
      const playlist = { ...body, id: body.id || `ci_xtream_${savedAccounts.length + 1}` };
      return json(route, { ok: true, playlist }, 201);
    }
  }
  const channelsMatch = url.pathname.match(/^\/api\/playlists\/([^/]+)\/channels$/);
  if (channelsMatch && method === 'GET') {
    const playlist = customPlaylists.get(decodeURIComponent(channelsMatch[1]));
    return json(route, { channels: playlist?.channels || [] });
  }
  const channelWrite = url.pathname.match(/^\/api\/playlists\/([^/]+)\/channels\/([^/]+)$/);
  if (channelWrite && method === 'PUT') {
    const playlistId = decodeURIComponent(channelWrite[1]);
    const body = request.postDataJSON();
    writes.push({ target: 'custom-channel', playlistId, body });
    const playlist = customPlaylists.get(playlistId);
    assert.ok(playlist, `custom playlist ${playlistId} must exist before channel write`);
    const row = { ...body, id: body.channelId, sources: body.sources || [] };
    const index = playlist.channels.findIndex(item => item.id === row.id || item.channelId === row.channelId);
    if (index >= 0) playlist.channels[index] = row; else playlist.channels.push(row);
    playlist.channelCount = playlist.channels.length;
    return json(route, { ok: true, channel: row });
  }
  if (/^\/api\/playlists\/[^/]+$/.test(url.pathname) && method === 'DELETE') {
    customPlaylists.delete(decodeURIComponent(url.pathname.split('/').pop()));
    return json(route, { ok: true });
  }
  return json(route, { ok: true });
});

await page.route('https://webtv-xtream.atonis.workers.dev/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (url.pathname === '/api/status') return json(route, { ok: true, service: 'WebTV Xtream', version: 'ci-proof' });
  if (url.pathname === '/api/accounts' && method === 'GET') return json(route, { accounts: savedAccounts });
  if (url.pathname === '/api/preview' && method === 'POST') {
    const body = request.postDataJSON();
    activeUsername = String(body.username || '');
    const channels = mappedCatalog(activeUsername);
    return json(route, {
      ok: true,
      previewToken: `ci-preview-${activeUsername}`,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      account: { name: body.name || activeUsername, server: body.server, tested: { status: 'Active' } },
      channels,
    });
  }
  if (url.pathname === '/api/channel-sources/from-preview' && method === 'POST') {
    const body = request.postDataJSON();
    lastMaterializedStreamId = String(body.streamId || '');
    const source = {
      id: `xch_ci_${lastMaterializedStreamId}`,
      name: body.name || `CI ${lastMaterializedStreamId}`,
      streamId: lastMaterializedStreamId,
      playbackUrl: `https://webtv-xtream.atonis.workers.dev/channel-stream/xch_ci_${encodeURIComponent(lastMaterializedStreamId)}/${encodeURIComponent(lastMaterializedStreamId)}.m3u8?s=ci`,
    };
    writes.push({ target: 'xtream-channel-source', body, source });
    return json(route, { ok: true, source }, 201);
  }
  if (url.pathname === '/api/accounts/from-preview' && method === 'POST') {
    const body = request.postDataJSON();
    const account = { id: `xt_ci_${savedAccounts.length + 1}`, name: body.name || 'CI Account', server: MOCK_URL, tested: { status: 'Active' } };
    savedAccounts.push(account);
    writes.push({ target: 'xtream-full-account', body, account });
    return json(route, { ok: true, account }, 201);
  }
  if (/^\/api\/accounts\/[^/]+$/.test(url.pathname) && method === 'DELETE') return json(route, { ok: true, deleted: true });
  if (/^\/api\/channel-sources\/[^/]+$/.test(url.pathname) && method === 'DELETE') return json(route, { ok: true, deleted: true });
  return json(route, { ok: true });
});

await page.route('https://webtv-source-verifier.atonis.workers.dev/**', async route => {
  const body = route.request().postDataJSON?.() || {};
  writes.push({ target: 'verifier', body: { sourceType: body.sourceType || body.candidate?.sourceType || 'unknown' } });
  return json(route, { status: 'VERIFIED', verified: true, detail: 'CI browser proof verified mock preview' });
});

const started = Date.now();
const response = await page.goto(WEBV2_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
assert.ok(response && response.ok(), `production WebV2 must load: ${WEBV2_URL} (${response?.status()})`);
assert.equal(await page.title(), 'WebTV V2', 'production page title must be WebTV V2');
await page.waitForSelector('#playlist-manager-toggle', { timeout: 20_000 });
await page.evaluate(() => document.documentElement.classList.add('admin-unlocked'));
await page.locator('#playlist-manager-toggle').click();
await page.waitForSelector('#xtream-tool-card', { timeout: 20_000 });
timings.productionLoadMs = Date.now() - started;

const originalPlayer = await page.evaluate(() => ({
  videoSrc: document.getElementById('video')?.getAttribute('src') || '',
  iframeSrc: document.getElementById('iframe')?.getAttribute('src') || '',
  channelName: document.getElementById('channel-name')?.textContent || '',
}));

async function runPreview(username) {
  await page.locator('#xtream-name').fill(`CI ${username}`);
  await page.locator('#xtream-server').fill(MOCK_URL);
  await page.locator('#xtream-username').fill(username);
  await page.locator('#xtream-password').fill('test_pass');
  const t0 = Date.now();
  await page.locator('#xtream-connect-save').click();
  const expected = Number(username.split('_')[1]);
  await page.waitForFunction(count => {
    const preview = window.WebTVXtream?.getPreview?.();
    return preview?.phase === 'preview-ready' && preview?.channelCount === count;
  }, expected, { timeout: 30_000 });
  const elapsed = Date.now() - t0;
  timings[`preview_${expected}_ms`] = elapsed;
  const rowCount = await page.locator('#xtream-preview-catalog .xtream-preview-row').count();
  assert.ok(rowCount > 0 && rowCount <= 100, `${username} must render 1..100 channel rows, got ${rowCount}`);
  const info = await page.locator('#xtream-preview-page-info').textContent();
  assert.match(info || '', new RegExp(`^${expected} matches`), `${username} page info must report full catalog`);
  return { expected, rowCount, elapsed };
}

const sizeResults = [];
for (const username of profiles) sizeResults.push(await runPreview(username));
await page.screenshot({ path: path.join(ARTIFACT_DIR, '01-preview-5000.png'), fullPage: true });

const largeRaw = providerCatalogs.get('test_5000').streams;
const filterTarget = String(largeRaw[Math.max(0, largeRaw.length - 1)].name);
const filterStart = Date.now();
await page.locator('#xtream-preview-query').fill(filterTarget);
await page.waitForFunction(name => {
  const rows = [...document.querySelectorAll('#xtream-preview-catalog .xtream-preview-row strong')];
  return rows.some(row => row.textContent === name);
}, filterTarget, { timeout: 5_000 });
timings.filter5000Ms = Date.now() - filterStart;
assert.ok(timings.filter5000Ms < 2000, `5000-channel filter should remain responsive, got ${timings.filter5000Ms}ms`);
assert.ok(await page.locator('#xtream-preview-catalog .xtream-preview-row').count() <= 100, 'filtered 5000 catalog must stay bounded');
await page.screenshot({ path: path.join(ARTIFACT_DIR, '02-filter-5000.png'), fullPage: true });

await page.locator('#xtream-preview-query').fill('');
await page.waitForTimeout(250);
await page.locator('#xtream-preview-catalog .xtream-preview-row').first().click();
await page.locator('#xtream-preview-verify').click();
await page.waitForFunction(() => window.WebTVXtream?.getPreview?.()?.candidate?.verificationStatus === 'VERIFIED', null, { timeout: 10_000 });
assert.equal(await page.locator('#xtream-preview-save-channel').isEnabled(), true, 'verified preview must unlock Save Channel');
assert.equal(await page.locator('#xtream-preview-save-account').isEnabled(), true, 'verified preview must unlock Save Full Account');

await page.locator('#xtream-preview-save-channel').click();
await page.waitForSelector('#xtream-save-destination-dialog[open]', { timeout: 5_000 });
await page.locator('#xtream-save-destination-select').selectOption('new-custom');
await page.locator('#xtream-save-new-name').fill('CI Greek Favorites');
await page.locator('input[name="xtream-save-source-scope"][value="selected"]').check();
await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-save-dialog-selected.png'), fullPage: true });
await page.locator('#xtream-save-destination-confirm').click();
await page.waitForFunction(() => document.getElementById('xtream-status')?.textContent?.includes('selected source'), null, { timeout: 10_000 });
const created = [...customPlaylists.values()].find(item => item.name === 'CI Greek Favorites');
assert.ok(created, 'Selected-source save must create Custom Playlist in in-memory intercepted backend');
assert.equal(created.channels.length, 1, 'Selected-source save must persist one channel');
assert.equal(created.channels[0].sources.length, 1, 'Selected-source save must persist exactly one source');

await page.locator('#xtream-preview-save-channel').click();
await page.waitForSelector('#xtream-save-destination-dialog[open]', { timeout: 5_000 });
await page.locator('#xtream-save-destination-select').selectOption(`custom:${created.id}`);
await page.locator('input[name="xtream-save-source-scope"][value="all-known"]').check();
await page.screenshot({ path: path.join(ARTIFACT_DIR, '04-save-dialog-all-known.png'), fullPage: true });
await page.locator('#xtream-save-destination-confirm').click();
await page.waitForFunction(() => document.getElementById('xtream-status')?.textContent?.includes('all known sources'), null, { timeout: 10_000 });
assert.equal(created.channels.length, 1, 'All-known save must merge same channel, not duplicate it');
assert.ok(created.channels[0].sources.length >= 2, `All-known save must include selected + already-known source, got ${created.channels[0].sources.length}`);

await page.locator('#xtream-preview-save-account').click();
await page.waitForFunction(() => document.getElementById('xtream-status')?.textContent?.includes('saved as live Xtream playlist'), null, { timeout: 10_000 });
assert.equal(savedAccounts.length, 1, 'Full Account save must persist one intercepted account reference');
assert.ok(writes.some(item => item.target === 'registry-playlists' && item.body?.kind === 'xtream'), 'Full Account save must create an account-backed Saved Playlist entry');
await page.screenshot({ path: path.join(ARTIFACT_DIR, '05-full-account-saved.png'), fullPage: true });

const finalPlayer = await page.evaluate(() => ({
  videoSrc: document.getElementById('video')?.getAttribute('src') || '',
  iframeSrc: document.getElementById('iframe')?.getAttribute('src') || '',
  channelName: document.getElementById('channel-name')?.textContent || '',
}));
assert.deepEqual(finalPlayer, originalPlayer, 'Preview/save flow must not change Player or Now Playing selection');

const unexpectedRealWrites = writes.filter(item => item.target === 'unexpected-real-write');
assert.equal(unexpectedRealWrites.length, 0, 'no persistence write may escape request interception');
assert.equal(pageErrors.length, 0, `page errors: ${pageErrors.join(' | ')}`);

const report = {
  webv2Url: WEBV2_URL,
  mockUrl: MOCK_URL,
  liveProviderProof,
  sizeResults,
  timings,
  boundedRenderMaxObserved: Math.max(...sizeResults.map(item => item.rowCount)),
  customPlaylist: { id: created.id, channels: created.channels.length, sources: created.channels[0].sources.length },
  fullAccountSaved: savedAccounts[0],
  playerUnchanged: true,
  pageErrors,
  consoleErrors,
  writes: writes.map(item => ({ target: item.target, kind: item.body?.kind, playlistId: item.playlistId, sourceCount: item.body?.sources?.length })),
};
await fs.writeFile(path.join(ARTIFACT_DIR, 'report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(ARTIFACT_DIR, 'console-errors.txt'), consoleErrors.join('\n'));
console.log(JSON.stringify(report, null, 2));

await browser.close();
