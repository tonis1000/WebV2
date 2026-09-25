import {
  listXtreamAccounts,
  saveXtreamAccount,
  deleteXtreamAccount,
  loadXtreamChannels,
  xtreamChannelsToM3U,
  summarizeXtreamChannels,
  xtreamBridgeUrl,
  setXtreamBridgeUrl,
} from './xtream-client.js?v=20260925-xtream1';

const $ = id => document.getElementById(id);
let accounts = [];
let loaded = null;

function setStatus(text, tone = 'idle') {
  const el = $('xtream-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

async function ensureUiSession() {
  const auth = window.WebTVRegistryAuth;
  if (!auth?.ensureSession) throw new Error('Trusted-device auth is not ready. Reload the page once.');
  setStatus('Checking trusted-device access…', 'busy');
  const ok = await auth.ensureSession({ interactive: true });
  if (!ok) throw new Error('Trusted-device session required');
  return true;
}

function selectedMode() {
  return document.querySelector('input[name="playlist-mode"]:checked')?.value || 'replace';
}

function renderPreview(channels, account) {
  const box = $('playlist-preview');
  if (!box) return;
  const summary = summarizeXtreamChannels(channels);
  box.innerHTML = '';
  const top = document.createElement('div');
  top.className = 'playlist-preview-top';
  top.innerHTML = `<strong>Xtream · ${escapeHtml(account?.name || 'Account')}</strong><span>${summary.count} channels · ${summary.groups} groups</span>`;
  box.appendChild(top);
  const chips = document.createElement('div');
  chips.className = 'playlist-preview-chips';
  for (const name of summary.sample) {
    const chip = document.createElement('span');
    chip.textContent = name;
    chips.appendChild(chip);
  }
  if (summary.count > summary.sample.length) {
    const more = document.createElement('span');
    more.textContent = `+${summary.count - summary.sample.length} more`;
    chips.appendChild(more);
  }
  box.appendChild(chips);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function renderAccounts() {
  const select = $('xtream-account-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choose account</option>';
  for (const account of accounts) {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name || account.server} · ${account.server}`;
    select.appendChild(option);
  }
  if (accounts.some(a => a.id === current)) select.value = current;
}

async function refreshAccounts({ quiet = false, interactive = true } = {}) {
  try {
    if (interactive) await ensureUiSession();
    if (!quiet) setStatus('Loading Xtream accounts…', 'busy');
    accounts = await listXtreamAccounts();
    renderAccounts();
    if (!quiet) setStatus(`${accounts.length} Xtream account${accounts.length === 1 ? '' : 's'} ready`, 'ok');
    return accounts;
  } catch (error) {
    if (!quiet) setStatus(error.message, 'error');
    throw error;
  }
}

async function connectAndSave() {
  const button = $('xtream-connect-save');
  const name = $('xtream-name')?.value.trim() || '';
  const server = $('xtream-server')?.value.trim() || '';
  const username = $('xtream-username')?.value.trim() || '';
  const password = $('xtream-password')?.value || '';
  if (!server || !username || !password) {
    setStatus('Server, username and password are required', 'error');
    return;
  }
  try {
    if (button) button.disabled = true;
    await ensureUiSession();
    setStatus('Testing Xtream login and saving securely…', 'busy');
    const account = await saveXtreamAccount({ name, server, username, password });
    $('xtream-password').value = '';
    await refreshAccounts({ quiet: true, interactive: false });
    $('xtream-account-select').value = account.id;
    setStatus(`${account.name || account.server} connected · credentials stored encrypted in D1`, 'ok');
  } catch (error) {
    setStatus(`Xtream test failed · ${error.message}`, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadSelectedAccount() {
  const accountId = $('xtream-account-select')?.value || '';
  if (!accountId) {
    setStatus('Choose an Xtream account first', 'error');
    return;
  }
  try {
    await ensureUiSession();
    setStatus('Loading Xtream live channels…', 'busy');
    loaded = await loadXtreamChannels(accountId);
    if (!loaded.channels.length) throw new Error('No live channels returned by this Xtream account');
    const text = xtreamChannelsToM3U(loaded.channels, loaded.account || {});
    const bridge = window.WebTVPlaylistAPI;
    if (!bridge?.applyText) throw new Error('WebTV playlist bridge is not ready');
    const label = `Xtream · ${loaded.account?.name || loaded.account?.server || accountId}`;
    const result = bridge.applyText(text, { mode: selectedMode(), label });
    renderPreview(loaded.channels, loaded.account);
    setStatus(`${result.imported} Xtream channels loaded temporarily · ${selectedMode()}`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function removeSelectedAccount() {
  const accountId = $('xtream-account-select')?.value || '';
  if (!accountId) return;
  const account = accounts.find(a => a.id === accountId);
  if (!confirm(`Delete Xtream account “${account?.name || account?.server || accountId}”? Channels already saved in My Playlist will stop working until their source is replaced.`)) return;
  try {
    await ensureUiSession();
    setStatus('Deleting Xtream account…', 'busy');
    await deleteXtreamAccount(accountId);
    loaded = null;
    await refreshAccounts({ quiet: true, interactive: false });
    setStatus('Xtream account deleted', 'idle');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function saveBridgeSetting() {
  const input = $('xtream-bridge-url');
  if (!input) return;
  try {
    const url = setXtreamBridgeUrl(input.value);
    input.value = url;
    setStatus('Xtream bridge URL saved on this device', 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function injectUi() {
  const grid = document.querySelector('#playlist-manager .playlist-manager-grid');
  if (!grid || $('xtream-tool-card')) return;

  const card = document.createElement('article');
  card.id = 'xtream-tool-card';
  card.className = 'playlist-tool-card xtream-tool-card';
  card.innerHTML = `
    <div class="playlist-tool-title">
      <span class="playlist-tool-icon">👤</span>
      <div>
        <strong>Xtream · User & Pass</strong>
        <span>Πρόσθεσε λογαριασμούς Xtream, φόρτωσε τα live κανάλια προσωρινά και βάλε όποια θέλεις στη My Playlist. Η My Playlist μπορεί να αναμειγνύει M3U και διαφορετικά Xtream accounts.</span>
      </div>
    </div>
    <input id="xtream-name" type="text" placeholder="Account name (π.χ. Provider A)">
    <input id="xtream-server" type="url" placeholder="http://server.example:8080">
    <div class="xtream-credentials-row">
      <input id="xtream-username" type="text" autocomplete="username" placeholder="Username">
      <input id="xtream-password" type="password" autocomplete="current-password" placeholder="Password">
    </div>
    <div class="playlist-actions">
      <button id="xtream-connect-save" class="button playlists" type="button">Test & Save</button>
      <button id="xtream-refresh-accounts" class="button ghost" type="button">Refresh</button>
    </div>
    <select id="xtream-account-select"><option value="">Choose account</option></select>
    <div class="playlist-actions">
      <button id="xtream-load" class="button" type="button">Load channels</button>
      <button id="xtream-delete" class="button danger" type="button">Delete account</button>
    </div>
    <details class="xtream-advanced">
      <summary>Bridge settings</summary>
      <div class="inline-form">
        <input id="xtream-bridge-url" type="url" value="${escapeHtml(xtreamBridgeUrl())}" aria-label="Xtream bridge URL">
        <button id="xtream-save-bridge" class="button ghost" type="button">Save</button>
      </div>
    </details>
    <div id="xtream-status" class="playlist-manager-status" data-tone="idle">Xtream ready · press Test & Save</div>
  `;
  grid.appendChild(card);

  $('xtream-connect-save')?.addEventListener('click', connectAndSave);
  $('xtream-refresh-accounts')?.addEventListener('click', () => refreshAccounts());
  $('xtream-load')?.addEventListener('click', loadSelectedAccount);
  $('xtream-delete')?.addEventListener('click', removeSelectedAccount);
  $('xtream-save-bridge')?.addEventListener('click', saveBridgeSetting);

  const token = window.WebTVRegistryAuth?.token?.() || '';
  if (token) refreshAccounts({ quiet: true, interactive: false }).catch(() => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUi, { once: true });
else injectUi();

window.WebTVXtream = {
  refreshAccounts,
  loadSelectedAccount,
  getLoaded: () => loaded,
};
