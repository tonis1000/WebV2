const PREVIEW_SELECTOR = '#playlist-preview';

function channelRows() {
  return [...document.querySelectorAll('#channel-list .channel-item')];
}

function findChannelRow(name) {
  const target = String(name || '').trim();
  return channelRows().find(row => row.querySelector('strong')?.textContent?.trim() === target) || null;
}

function makeChipClickable(chip) {
  if (!(chip instanceof HTMLElement) || chip.dataset.xtreamClickable === '1') return;
  const name = chip.textContent?.trim() || '';
  if (!name || /^\+\d+ more$/i.test(name)) return;

  chip.dataset.xtreamClickable = '1';
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  chip.title = `Play ${name}`;
  chip.style.cursor = 'pointer';

  const activate = () => {
    const row = findChannelRow(name);
    if (!row) {
      const status = document.getElementById('xtream-status');
      if (status) {
        status.textContent = `Channel “${name}” is not in the current temporary sidebar`;
        status.dataset.tone = 'error';
      }
      return;
    }

    row.click();
    document.getElementById('playlist-manager-close')?.click();
  };

  chip.addEventListener('click', activate);
  chip.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });
}

function wirePreview() {
  const preview = document.querySelector(PREVIEW_SELECTOR);
  if (!preview) return;
  preview.querySelectorAll('.playlist-preview-chips > span').forEach(makeChipClickable);
}

function start() {
  wirePreview();
  const preview = document.querySelector(PREVIEW_SELECTOR);
  if (!preview) return;
  new MutationObserver(wirePreview).observe(preview, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

console.info('[WebTV] Xtream preview actions loaded · build 20260925-xtream-click1');
