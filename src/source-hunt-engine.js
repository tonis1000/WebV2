import { officialFallbackFor, officialDiscoveryLinks } from './core/official-fallbacks.js?v=20260924-1435';

const BUILD_ID = '20260924-1435';
const API = 'https://api.github.com';
const FRESH_DAYS = 30;
const MAX_REPOS = 8;
const MAX_RAW_FILES = 10;
const MAX_FILES_PER_REPO = 3;
const TARGET_CANDIDATES = 6;
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const channelNameEl = $('channel-name');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagLog = $('diagnostic-log');

const CHANNEL_FINGERPRINTS = {
  'ERT1': ['ert1', 'ert 1', 'ert1.gr', 'ept1'],
  'ERT2': ['ert2', 'ert 2', 'ert2.gr', 'ept2'],
  'ERT3': ['ert3', 'ert 3', 'ert3.gr', 'ept3'],
  'ERT News': ['ertnews', 'ert news', 'ert_news', 'ert-news', 'ertnews.gr'],
  'ANT1': ['ant1', 'antenna1', 'antenna gr', 'ant1.gr'],
  'Alpha TV': ['alpha tv', 'alphatv', 'alpha.gr'],
  'SKAI': ['skai', 'skaitv', 'skai tv', 'skai.gr'],
  'Open TV': ['open tv', 'opentv', 'open beyond', 'open.gr'],
  'MEGA': ['mega tv', 'megatv', 'mega channel', 'mega.gr'],
  'Star TV': ['star tv', 'startv', 'star channel', 'star.gr'],
  'Action 24': ['action 24', 'action24', 'action tv', 'action24.gr'],
  'Kontra': ['kontra', 'kontra channel', 'kontrachannel.gr'],
  'MADTV': ['madtv', 'mad tv', 'mad tv greece', 'madtvgreece'],
};

const SEED_REPOS = [
  'kilirushi/iptv',
  'iptv-org/iptv',
  'LIVE-GRECO/TV-LIVE-GRECO',
  'don24crk/Don24crk-Repository',
  'sieutv/livetv',
  'jimgate07/grtv',
];

function log(message) {
  if (!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}
function sinceDate(days = FRESH_DAYS) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }
function freshCutoffMs(days = FRESH_DAYS) { return Date.now() - days * 24 * 60 * 60 * 1000; }
function isFresh(value, days = FRESH_DAYS) { if (!value) return false; const time = new Date(value).getTime(); return Number.isFinite(time) && time >= freshCutoffMs(days); }
function extractM3u8(text = '') { const found = text.match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi) || []; return [...new Set(found.map(url => url.replace(/[),.;]+$/g, '')))]; }
function fingerprints(name) { return CHANNEL_FINGERPRINTS[name] || [String(name || '').toLowerCase()]; }
function normalize(text = '') { return String(text).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi, ' '); }
function relevance(text, name) { const hay = normalize(text); let best = 0; for (const fp of fingerprints(name)) { const needle = normalize(fp).trim(); if (!needle) continue; if (hay.includes(needle)) best = Math.max(best, needle.length >= 6 ? 4 : 3); } return best; }
function urlRelevance(url, name) { return relevance(url, name); }
function currentChannel(name = '') {
  const selected = window.WebTVPlaylistAPI?.getSelectedChannel?.();
  if (selected) return selected;
  return { id: name, originalId: name, name };
}

async function gh(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!response.ok) { const remaining = response.headers.get('x-ratelimit-remaining'); throw new Error(`GitHub API ${response.status}${remaining === '0' ? ' · rate limit reached' : ''}`); }
  return response.json();
}
async function fetchText(url) { const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); }

function collectFromM3U(text, name, meta) {
  const lines = String(text || '').split(/\r?\n/); const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line.startsWith('#EXTINF')) continue;
    const headerScore = relevance(line, name); if (!headerScore) continue;
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim(); if (!next) { j++; continue; } if (next.startsWith('#EXTINF')) break; if (next.startsWith('#')) { j++; continue; }
      for (const url of extractM3u8(next)) out.push({ url, origin: `${meta.origin} · M3U exact`, detail: meta.detail, updatedAt: meta.updatedAt, score: 40 + headerScore * 5 + urlRelevance(url, name) * 3 });
      break;
    }
  }
  return out;
}
function collectFromLooseText(text, name, meta) {
  const lines = String(text || '').split(/\r?\n/); const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\.m3u8/i.test(lines[i])) continue;
    const urls = extractM3u8(lines[i]); if (!urls.length) continue;
    const tightContext = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n');
    const contextScore = relevance(tightContext, name);
    for (const url of urls) { const uScore = urlRelevance(url, name); if (!uScore && !contextScore) continue; out.push({ url, origin: meta.origin, detail: meta.detail, updatedAt: meta.updatedAt, score: 12 + contextScore * 3 + uScore * 5 }); }
  }
  return out;
}
function collectFromText(text, name, meta) { const isM3U = /#EXTM3U|#EXTINF/i.test(text) || /\.m3u8?$/i.test(meta.detail || ''); const exact = isM3U ? collectFromM3U(text, name, meta) : []; return exact.length ? exact : collectFromLooseText(text, name, meta); }

async function huntIssues(name, since) {
  const primary = fingerprints(name)[0] || name;
  const data = await gh(`/search/issues?q=${encodeURIComponent(`"${primary}" m3u8 updated:>=${since}`)}&sort=updated&order=desc&per_page=8`);
  const out = [];
  for (const item of data.items || []) {
    if (!isFresh(item.updated_at)) continue;
    const body = `${item.title || ''}\n${item.body || ''}`; if (!relevance(body, name)) continue;
    out.push(...collectFromLooseText(body, name, { origin: 'GitHub issue', detail: item.repository_url?.split('/repos/')[1] || item.html_url, updatedAt: item.updated_at }));
    if (out.length >= TARGET_CANDIDATES) break;
  }
  return out;
}

async function discoverRepos(name) {
  const repos = new Map();
  for (const full of SEED_REPOS) repos.set(full, { full_name: full, default_branch: 'main', updated_at: null, seeded: true });
  const primary = fingerprints(name)[0] || name;
  for (const q of [`${primary} IPTV Greece`, `${primary} m3u Greece`]) {
    try { const data = await gh(`/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=4`); for (const repo of data.items || []) repos.set(repo.full_name, repo); } catch {}
  }
  return [...repos.values()].slice(0, MAX_REPOS);
}
function pathScore(path = '', name = '') {
  const p = path.toLowerCase(); let score = relevance(path, name) * 20;
  if (/\.m3u8?$/.test(p)) score += 8;
  if (/\.(txt|md|html?|js|json)$/.test(p)) score += 2;
  if (/(greek|greece|\bgr\b|iptv|playlist|channel|tv)/.test(p)) score += 5;
  return score;
}
async function repoMeta(repo) { try { return await gh(`/repos/${repo.full_name}`); } catch { return repo; } }

async function deepScanRepo(repo, name, budget) {
  if (budget.remaining <= 0) return [];
  const meta = await repoMeta(repo);
  const repoUpdatedAt = meta.pushed_at || meta.updated_at || repo.pushed_at || repo.updated_at;
  if (!isFresh(repoUpdatedAt)) return [];
  const branch = meta.default_branch || 'main';
  let tree; try { tree = await gh(`/repos/${repo.full_name}/git/trees/${encodeURIComponent(branch)}?recursive=1`); } catch { return []; }

  const candidates = (tree.tree || [])
    .filter(item => item.type === 'blob' && /\.(m3u8?|txt|md|html?|js|json)$/i.test(item.path || ''))
    .map(item => ({ ...item, relevance: relevance(item.path, name), priority: pathScore(item.path, name) }))
    .sort((a, b) => b.priority - a.priority);

  const relevant = candidates.filter(item => item.relevance > 0).slice(0, MAX_FILES_PER_REPO);
  const generic = candidates.find(item => item.relevance === 0 && /(?:playlist|iptv|greek|greece|\.m3u)$/i.test(item.path || ''));
  const files = relevant.length ? relevant : (generic ? [generic] : candidates.slice(0, 1));
  const out = [];
  for (const file of files) {
    if (budget.remaining <= 0 || out.length >= TARGET_CANDIDATES) break;
    budget.remaining -= 1; budget.used += 1;
    const raw = `https://raw.githubusercontent.com/${repo.full_name}/${encodeURIComponent(branch)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const text = await fetchText(raw);
      if (!relevance(text, name) && !relevance(file.path, name)) continue;
      out.push(...collectFromText(text, name, { origin: 'GitHub deep scan', detail: `${repo.full_name}/${file.path}`, updatedAt: repoUpdatedAt }));
    } catch {}
  }
  return out;
}

async function huntRepositories(name) {
  const repos = await discoverRepos(name); const out = []; const budget = { remaining: MAX_RAW_FILES, used: 0 };
  for (const repo of repos) {
    if (budget.remaining <= 0 || out.length >= TARGET_CANDIDATES) break;
    try { out.push(...await deepScanRepo(repo, name, budget)); } catch {}
  }
  log(`HUNT BUDGET ${name} · ${budget.used}/${MAX_RAW_FILES} raw file(s) · ${Math.min(repos.length, MAX_REPOS)} repo(s)`);
  return out;
}
function dedupeAndRank(items) {
  const map = new Map();
  for (const item of items) { if (!isFresh(item.updatedAt)) continue; if (!map.has(item.url) || (item.score || 0) > (map.get(item.url).score || 0)) map.set(item.url, item); }
  return [...map.values()].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || (b.score || 0) - (a.score || 0)).slice(0, 8);
}

function ensureOfficialUi() {
  if (!panel) return null;
  let wrap = $('hunt-official');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'hunt-official';
  wrap.className = 'hunt-auto';
  wrap.innerHTML = `<div class="hunt-auto-head"><div><strong>Official Fallback Discovery</strong><span id="hunt-official-status">Select a channel · verified registry + official searches</span></div></div><div id="hunt-official-results" class="hunt-results"></div>`;
  const tester = panel.querySelector('.candidate-tester');
  panel.insertBefore(wrap, tester || null);
  return wrap;
}

function renderOfficialDiscovery(name = '') {
  ensureOfficialUi();
  const results = $('hunt-official-results');
  const status = $('hunt-official-status');
  if (!results || !status) return;
  results.innerHTML = '';
  if (!name || name === 'Επίλεξε κανάλι') {
    status.textContent = 'Select a channel · verified registry + official searches';
    return;
  }

  const channel = currentChannel(name);
  const fallback = officialFallbackFor(channel);
  const searches = officialDiscoveryLinks(channel);
  status.textContent = fallback
    ? `Verified fallback available · ${fallback.label || fallback.route || 'official'}`
    : 'No verified fallback yet · official discovery links ready';

  if (fallback) {
    const card = document.createElement('div'); card.className = 'hunt-result';
    const meta = document.createElement('div'), strong = document.createElement('strong'), detail = document.createElement('span'), code = document.createElement('code');
    strong.textContent = `Verified · ${fallback.label || 'Official fallback'}`;
    detail.textContent = 'Used only after normal stream routes fail. Not stored as an IPTV source.';
    code.textContent = fallback.externalUrl || fallback.embedUrl || '';
    meta.append(strong, detail, code);
    const open = document.createElement('a'); open.className = 'button'; open.textContent = 'Open official ↗'; open.href = fallback.externalUrl || '#'; open.target = '_blank'; open.rel = 'noopener noreferrer';
    card.append(meta, open); results.appendChild(card);
  }

  for (const item of searches) {
    const card = document.createElement('div'); card.className = 'hunt-result';
    const meta = document.createElement('div'), strong = document.createElement('strong'), detail = document.createElement('span');
    strong.textContent = item.label; detail.textContent = item.detail; meta.append(strong, detail);
    const open = document.createElement('a'); open.className = 'button ghost'; open.textContent = 'Search ↗'; open.href = item.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
    card.append(meta, open); results.appendChild(card);
  }
}

function ensureUi() {
  if (!panel) return null; let wrap = $('hunt-auto'); if (wrap) { ensureOfficialUi(); return wrap; }
  wrap = document.createElement('div'); wrap.id = 'hunt-auto'; wrap.className = 'hunt-auto';
  wrap.innerHTML = `<div class="hunt-auto-head"><div><strong>Automatic Hunt</strong><span id="hunt-auto-status">Ready · bounded scan · last ${FRESH_DAYS} days</span></div><button id="run-hunt" class="button" type="button">Run Hunt</button></div><div id="hunt-results" class="hunt-results"></div>`;
  const tester = panel.querySelector('.candidate-tester'); panel.insertBefore(wrap, tester || null); ensureOfficialUi(); return wrap;
}
function renderResults(items, name) {
  const results = $('hunt-results'); if (!results) return; results.innerHTML = '';
  if (!items.length) { const empty = document.createElement('div'); empty.className = 'hunt-empty'; empty.textContent = `Δεν βρέθηκε exact candidate για ${name} με activity μέσα στις τελευταίες ${FRESH_DAYS} ημέρες.`; results.appendChild(empty); return; }
  for (const item of items) {
    const card = document.createElement('div'); card.className = 'hunt-result';
    const meta = document.createElement('div'), source = document.createElement('strong'), detail = document.createElement('span'), url = document.createElement('code');
    source.textContent = item.origin; const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('de-DE') : ''; detail.textContent = `${item.detail || ''}${date ? ` · ${date}` : ''}`; url.textContent = item.url; meta.append(source, detail, url);
    const test = document.createElement('button'); test.type = 'button'; test.className = 'button'; test.textContent = 'Test';
    test.addEventListener('click', () => { if (candidateInput) candidateInput.value = item.url; candidateInput?.dispatchEvent(new Event('input', { bubbles: true })); testButton?.click(); log(`HUNT candidate selected · ${name} · ${item.url}`); });
    card.append(meta, test); results.appendChild(card);
  }
}
async function runHunt() {
  const name = channelNameEl?.textContent?.trim(); if (!name || name === 'Επίλεξε κανάλι') return;
  renderOfficialDiscovery(name);
  const button = $('run-hunt'), status = $('hunt-auto-status'), since = sinceDate(); if (button) button.disabled = true;
  if (status) status.textContent = `Searching ${name} · bounded scan…`; log(`RUN HUNT ${name} · streams + official fallback discovery · max ${MAX_RAW_FILES} raw files · ${FRESH_DAYS}d`);
  try {
    const settled = await Promise.allSettled([huntIssues(name, since), huntRepositories(name)]);
    const items = dedupeAndRank(settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])); renderResults(items, name);
    const failures = settled.filter(result => result.status === 'rejected').length;
    if (status) status.textContent = `${items.length} stream candidate${items.length === 1 ? '' : 's'} · official searches ready · max ${MAX_RAW_FILES} raw files${failures ? ' · partial' : ''}`;
    log(`HUNT DONE ${name} · ${items.length} stream candidate(s) · official fallback lane ready${failures ? ` · ${failures} source(s) failed` : ''}`);
  } catch (error) { if (status) status.textContent = `Search failed: ${error.message}`; renderResults([], name); log(`HUNT ERROR ${name} · ${error.message}`); }
  finally { if (button) button.disabled = false; }
}

if (ensureUi()) {
  $('run-hunt')?.addEventListener('click', runHunt);
  const refreshOfficial = () => renderOfficialDiscovery(channelNameEl?.textContent?.trim() || '');
  if (channelNameEl) new MutationObserver(refreshOfficial).observe(channelNameEl, { childList: true, characterData: true, subtree: true });
  window.addEventListener('webtv:ready', refreshOfficial);
  refreshOfficial();
  log(`Source Hunt engine loaded · build ${BUILD_ID} · streams + official fallback discovery · bounded ${MAX_RAW_FILES} raw files max`);
}
