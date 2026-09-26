const PARAM = 'layout';
const VALUE = 'rail';
const DESKTOP = '(min-width: 1180px)';
const BUILD_ID = '20260926-right-rail-preview-v3';

const enabled = new URLSearchParams(location.search).get(PARAM) === VALUE;
if (!enabled) {
  console.info(`[WebTV] Right rail preview inactive · add ?${PARAM}=${VALUE}`);
} else {
  const mq = window.matchMedia(DESKTOP);
  const moved = new Map();
  let rail = null;
  let observer = null;
  let epgObserver = null;
  let active = false;

  function rememberAndMove(node, target) {
    if (!node || !target || node.parentNode === target) return;
    if (!moved.has(node)) {
      const marker = document.createComment(`webtv-rail:${node.id || node.className || node.tagName}`);
      node.parentNode?.insertBefore(marker, node);
      moved.set(node, marker);
    }
    target.appendChild(node);
  }

  function restoreNode(node) {
    const marker = moved.get(node);
    if (!marker?.parentNode) return;
    marker.parentNode.insertBefore(node, marker.nextSibling);
    marker.remove();
    moved.delete(node);
  }

  function ensureRail() {
    if (rail?.isConnected) return rail;
    const layout = document.querySelector('main.layout');
    if (!layout) return null;
    rail = document.createElement('aside');
    rail.id = 'desktop-control-rail';
    rail.className = 'desktop-control-rail panel';
    rail.setAttribute('aria-label', 'Desktop controls');
    rail.innerHTML = '<div id="desktop-rail-stack" class="desktop-rail-stack"></div>';
    layout.appendChild(rail);
    return rail;
  }

  function findDiscoveryButton() {
    return [...document.querySelectorAll('button')].find(button => /discovery\s*beta/i.test(button.textContent || '')) || null;
  }

  function moveControls() {
    if (!active) return;
    const target = ensureRail()?.querySelector('#desktop-rail-stack');
    if (!target) return;

    const brand = document.querySelector('.topbar > div:first-child');
    const clock = document.getElementById('clock');
    const favorite = document.getElementById('favorite-channel');
    const playlists = document.getElementById('playlist-manager-toggle');
    const catalog = document.getElementById('current-catalog-badge');
    const hunt = document.getElementById('source-hunt-toggle');
    const discovery = findDiscoveryButton();
    const diagnostics = document.getElementById('diagnostics-toggle');

    [brand, clock, favorite, playlists, catalog, hunt, discovery, diagnostics]
      .filter(Boolean)
      .forEach(node => rememberAndMove(node, target));

    if (brand) brand.classList.add('rail-brand');
    if (clock) clock.classList.add('rail-clock');
    [favorite, playlists, catalog, hunt, discovery, diagnostics].forEach(node => node?.classList.add('rail-control'));
  }

  function restoreAll() {
    [...moved.keys()].forEach(node => {
      node.classList?.remove('rail-brand', 'rail-clock', 'rail-control');
      restoreNode(node);
    });
    rail?.remove();
    rail = null;
  }

  function refreshExpandableDescription() {
    const desc = document.getElementById('program-description');
    if (!desc || !active) return;
    if (desc.classList.contains('expanded')) return;
    desc.classList.remove('is-expandable');
    requestAnimationFrame(() => {
      const overflow = desc.scrollHeight > desc.clientHeight + 2;
      desc.classList.toggle('is-expandable', overflow);
      desc.title = overflow ? 'Κλικ για εμφάνιση ολόκληρης της περιγραφής' : '';
    });
  }

  function installEpgExpansion() {
    const desc = document.getElementById('program-description');
    if (!desc || desc.dataset.railExpandBound === '1') return;
    desc.dataset.railExpandBound = '1';
    desc.addEventListener('click', () => {
      if (!active || (!desc.classList.contains('is-expandable') && !desc.classList.contains('expanded'))) return;
      desc.classList.toggle('expanded');
      desc.title = desc.classList.contains('expanded') ? 'Κλικ για σύμπτυξη' : 'Κλικ για εμφάνιση ολόκληρης της περιγραφής';
      if (!desc.classList.contains('expanded')) requestAnimationFrame(refreshExpandableDescription);
    });
    epgObserver = new MutationObserver(() => {
      desc.classList.remove('expanded');
      refreshExpandableDescription();
    });
    epgObserver.observe(desc, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', refreshExpandableDescription);
    refreshExpandableDescription();
  }

  function activate() {
    if (active) return;
    active = true;
    document.documentElement.classList.add('rail-preview');
    ensureRail();
    moveControls();
    installEpgExpansion();
    observer = new MutationObserver(() => {
      moveControls();
      refreshExpandableDescription();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.info(`[WebTV] Right rail preview active · build ${BUILD_ID}`);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    observer?.disconnect();
    observer = null;
    restoreAll();
    document.documentElement.classList.remove('rail-preview');
    const desc = document.getElementById('program-description');
    desc?.classList.remove('expanded', 'is-expandable');
    console.info('[WebTV] Right rail preview disabled for narrow viewport');
  }

  function applyMode() {
    if (mq.matches) activate();
    else deactivate();
  }

  const style = document.createElement('style');
  style.id = 'right-rail-preview-styles';
  style.textContent = `
    html.rail-preview body{background:radial-gradient(circle at 10% 0%,rgba(99,179,255,.08),transparent 27%),radial-gradient(circle at 100% 12%,rgba(61,220,151,.08),transparent 25%),var(--bg)}
    html.rail-preview .app-shell{width:min(1600px,calc(100% - 16px));margin:0 auto;padding:8px 0 14px}
    html.rail-preview .topbar{display:none!important}
    html.rail-preview .layout{grid-template-columns:320px minmax(0,1fr) 220px;gap:14px;align-items:start}
    html.rail-preview .sidebar{top:8px;height:calc(100vh - 16px)}
    html.rail-preview .viewer{min-width:0}
    html.rail-preview .desktop-control-rail{position:sticky;top:8px;min-height:calc(100vh - 16px);padding:14px 12px;background:linear-gradient(180deg,rgba(11,24,26,.98),rgba(8,17,20,.98));border-color:#244b55;box-shadow:0 18px 50px rgba(0,0,0,.28)}
    html.rail-preview .desktop-rail-stack{display:flex;flex-direction:column;align-items:stretch;gap:10px}
    html.rail-preview .rail-brand{padding:2px 4px 8px;border-bottom:1px solid rgba(99,179,255,.14)}
    html.rail-preview .rail-brand .eyebrow{margin:0;color:var(--accent);font-size:.78rem;letter-spacing:.15em}
    html.rail-preview .rail-clock{display:block;padding:2px 4px 12px;margin-bottom:14px;color:#d7e8f6;font-size:.9rem;border-bottom:1px solid rgba(99,179,255,.12)}
    html.rail-preview .rail-control{width:100%;min-height:40px;justify-content:center;text-align:center;margin:0!important}
    html.rail-preview #favorite-channel.rail-control{background:#33270d;border-color:#886817;color:#ffe39b}
    html.rail-preview #playlist-manager-toggle.rail-control{background:#123f59;border-color:#2e83ad;color:#d9f3ff}
    html.rail-preview #current-catalog-badge.rail-control{display:flex;max-width:none;padding:9px 10px;background:#0d1d29;border-color:#315d7a;color:#bfe0ff;border-radius:10px;white-space:normal;line-height:1.2}
    html.rail-preview #source-hunt-toggle.rail-control{background:#33250e;border-color:#86651f;color:#ffe0a0}
    html.rail-preview #diagnostics-toggle.rail-control{background:#091116;border-color:#33414c;color:#f4f7fa}
    html.rail-preview .channel-actions #favorite-channel{display:none!important}
    html.rail-preview .now-playing{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;padding-top:10px}
    html.rail-preview #program-description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-height:2.8em;line-height:1.4;transition:max-height .18s ease;color:var(--muted)}
    html.rail-preview #program-description.is-expandable{cursor:pointer;position:relative;padding-right:20px}
    html.rail-preview #program-description.is-expandable::after{content:'⌄';position:absolute;right:2px;bottom:0;color:var(--accent-2);font-weight:800}
    html.rail-preview #program-description.expanded{display:block;-webkit-line-clamp:unset;max-height:none;overflow:visible;cursor:pointer}
    html.rail-preview #program-description.expanded::after{content:'⌃'}
    html.rail-preview .next-programs{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}
    html.rail-preview .next-card{height:100%;min-height:62px}
  `;
  document.head.appendChild(style);

  mq.addEventListener?.('change', applyMode);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode, { once: true });
  else applyMode();
}
