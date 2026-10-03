const PARAM = 'layout';
const DESKTOP = '(min-width: 1180px)';
const BUILD_ID = '20261003-epg-guide-rail';

const layoutMode = new URLSearchParams(location.search).get(PARAM);
const enabled = layoutMode !== 'classic';
if (!enabled) {
  console.info('[WebTV] Right rail layout disabled by ?layout=classic');
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
    rail.innerHTML = `
      <div id="desktop-rail-stack" class="desktop-rail-stack">
        <section class="desktop-rail-group"><span class="desktop-rail-label">Library</span><div id="desktop-rail-library" class="desktop-rail-group-stack"></div></section>
        <section class="desktop-rail-group"><span class="desktop-rail-label">Search & Logos</span><div id="desktop-rail-discovery" class="desktop-rail-group-stack"></div></section>
        <section class="desktop-rail-group"><span class="desktop-rail-label">Tools</span><div id="desktop-rail-tools" class="desktop-rail-group-stack"></div></section>
        <section class="desktop-rail-group"><span class="desktop-rail-label">Channel</span><div id="desktop-rail-channel" class="desktop-rail-group-stack"></div></section>
      </div>`;
    layout.appendChild(rail);
    return rail;
  }

  function ensureCatalogBadge() {
    let badge = document.getElementById('current-catalog-badge');
    if (badge) return badge;
    badge = document.createElement('span');
    badge.id = 'current-catalog-badge';
    badge.className = 'current-catalog-badge';
    badge.textContent = '★ My Playlist: My Playlist';
    badge.title = 'Current catalog: My Playlist';
    const actions = document.querySelector('.topbar-actions');
    if (actions) actions.appendChild(badge);
    return badge;
  }

  function ensureHeaderDock(){
    const header=document.querySelector('.player-card .channel-header');
    if(!header)return null;
    let dock=document.getElementById('player-header-admin');
    if(!dock){dock=document.createElement('div');dock.id='player-header-admin';dock.className='player-header-admin';header.insertBefore(dock,header.querySelector('.channel-actions'));}
    return dock;
  }


  function moveControls() {
    if (!active) return;
    const root = ensureRail();
    const library = root?.querySelector('#desktop-rail-library');
    const discovery = root?.querySelector('#desktop-rail-discovery');
    const tools = root?.querySelector('#desktop-rail-tools');
    const channel = root?.querySelector('#desktop-rail-channel');
    if (!library || !discovery || !tools || !channel) return;

    const brand = document.querySelector('.topbar > div:first-child');
    const clock = document.getElementById('clock');
    const dock = ensureHeaderDock();
    const playlists = document.getElementById('playlist-manager-toggle');
    const catalog = ensureCatalogBadge();
    const search = document.getElementById('unified-search-toggle');
    const findLogo = document.getElementById('channel-logo-find');
    const repairLogos = document.getElementById('channel-logo-repair-missing');
    const epgGuide = document.getElementById('epg-guide-toggle');
    const sport = document.getElementById('sport-toggle');
    const hunt = document.getElementById('source-hunt-toggle');
    const diagnostics = document.getElementById('diagnostics-toggle');
    const favorite = document.getElementById('favorite-channel');
    const myAction = document.getElementById('my-playlist-channel-action');

    [brand,clock].filter(Boolean).forEach(node=>rememberAndMove(node,dock));
    [playlists,catalog].filter(Boolean).forEach(node=>rememberAndMove(node,library));
    [search,findLogo,repairLogos].filter(Boolean).forEach(node=>rememberAndMove(node,discovery));
    [epgGuide,sport,hunt,diagnostics].filter(Boolean).forEach(node=>rememberAndMove(node,tools));
    [favorite,myAction].filter(Boolean).forEach(node=>rememberAndMove(node,channel));

    if (brand) brand.classList.add('rail-brand');
    if (clock) clock.classList.add('rail-clock');
    [playlists,catalog,search,findLogo,repairLogos,epgGuide,sport,hunt,diagnostics,favorite,myAction].forEach(node => node?.classList.add('rail-control'));
    if (favorite) favorite.classList.add('rail-favorite');
  }

  function restoreAll() {
    [...moved.keys()].forEach(node => {
      node.classList?.remove('rail-brand', 'rail-clock', 'rail-control', 'rail-favorite');
      restoreNode(node);
    });
    document.getElementById('player-header-admin')?.remove();
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
    console.info(`[WebTV] Right rail layout active · build ${BUILD_ID}`);
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
    console.info('[WebTV] Right rail layout disabled for narrow viewport');
  }

  function applyMode() {
    if (mq.matches) activate();
    else deactivate();
  }

  const style = document.createElement('style');
  style.id = 'right-rail-preview-styles';
  style.textContent = `
    html.rail-preview body{background:radial-gradient(circle at 10% 0%,rgba(99,179,255,.08),transparent 27%),radial-gradient(circle at 100% 12%,rgba(61,220,151,.08),transparent 25%),var(--bg)}
    html.rail-preview .app-shell{width:min(1904px,calc(100% - 16px));margin:0 auto;padding:8px 0 12px}
    html.rail-preview .topbar{display:none!important}
    html.rail-preview .layout{grid-template-columns:300px minmax(0,1fr) 238px;gap:12px;align-items:start}
    html.rail-preview.admin-locked .layout{grid-template-columns:300px minmax(0,1fr)}
    html.rail-preview.admin-locked .desktop-control-rail{display:none!important}
    html.rail-preview .sidebar{top:8px;height:calc(100vh - 16px);min-height:0}
    html.rail-preview .viewer{min-width:0;gap:12px}
    html.rail-preview .player-card{width:100%;max-width:none;justify-self:stretch}
    html.rail-preview .player-stage{width:100%;height:min(62vh,760px);max-height:calc(100vh - 260px);min-height:320px;aspect-ratio:auto;overflow:hidden}
    html.rail-preview .player-stage video,html.rail-preview .player-stage iframe{position:absolute;inset:0;width:100%;height:100%;max-width:100%;object-fit:contain}
    html.rail-preview .desktop-control-rail{position:sticky;top:8px;height:calc(100vh - 16px);padding:12px 10px;overflow:auto;background:linear-gradient(180deg,rgba(11,24,26,.99),rgba(8,17,20,.99));border-color:#244b55;box-shadow:0 18px 50px rgba(0,0,0,.28)}
    html.rail-preview .desktop-rail-stack{display:grid;gap:12px}
    html.rail-preview .desktop-rail-group{display:grid;gap:7px;padding-bottom:12px;border-bottom:1px solid rgba(148,184,199,.14)}
    html.rail-preview .desktop-rail-group:last-child{border-bottom:0;padding-bottom:0}
    html.rail-preview .desktop-rail-label{padding:0 3px;color:#7695a3;font-size:.64rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
    html.rail-preview .desktop-rail-group-stack{display:grid;gap:7px}
    html.rail-preview .player-header-admin{display:flex;align-items:center;justify-content:center;gap:12px;min-width:0;margin-left:auto}
    html.rail-preview .player-header-admin .rail-brand{flex:none}
    html.rail-preview .player-header-admin .rail-clock{font-size:.78rem;white-space:nowrap;color:#d7e8f6}
    html.rail-preview .rail-control{width:100%;min-height:42px;display:flex!important;align-items:center;justify-content:center;text-align:center;margin:0!important;border-radius:11px;font-size:.82rem}
    html.rail-preview #playlist-manager-toggle.rail-control{background:#123f59;border-color:#2e83ad;color:#d9f3ff}
    html.rail-preview #current-catalog-badge.rail-control{max-width:none;padding:9px 10px;background:#0d1d29;border-color:#315d7a;color:#bfe0ff;white-space:normal;line-height:1.2}
    html.rail-preview #unified-search-toggle.rail-control{background:#142f3e;border-color:#347da0;color:#d9f4ff}
    html.rail-preview #channel-logo-find.rail-control{background:#24213d;border-color:#655aa0;color:#e0dcff}
    html.rail-preview #channel-logo-repair-missing.rail-control{background:#17372d;border-color:#347a60;color:#c9f6df}
    html.rail-preview #epg-guide-toggle.rail-control{background:#16334a;border-color:#3d80a8;color:#d9f3ff}
    html.rail-preview #sport-toggle.rail-control{background:#243214;border-color:#668536;color:#e5ffc7}
    html.rail-preview #source-hunt-toggle.rail-control{background:#33250e;border-color:#86651f;color:#ffe0a0}
    html.rail-preview #diagnostics-toggle.rail-control{background:#111820;border-color:#3a4652;color:#e8eef4}
    html.rail-preview #favorite-channel.rail-control{background:#33270d;border-color:#886817;color:#ffe39b}
    html.rail-preview #my-playlist-channel-action.rail-control{background:#17372d;border-color:#347a60;color:#d6f8e6}
    html.rail-preview #my-playlist-channel-action.rail-control[data-inside="1"]{background:#3a1d22;border-color:#71373f;color:#ffd1d5}
    html.rail-preview .rail-control[hidden]{display:none!important}
    html.rail-preview .now-playing{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;padding-top:10px}
    html.rail-preview #program-description{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-height:2.8em;line-height:1.4;transition:max-height .18s ease;color:var(--muted)}
    html.rail-preview #program-description.is-expandable{cursor:pointer;position:relative;padding-right:20px}
    html.rail-preview #program-description.is-expandable::after{content:'⌄';position:absolute;right:2px;bottom:0;color:var(--accent-2);font-weight:800}
    html.rail-preview #program-description.expanded{display:block;-webkit-line-clamp:unset;max-height:none;overflow:visible;cursor:pointer}
    html.rail-preview #program-description.expanded::after{content:'⌃'}
    html.rail-preview .next-programs{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}
    html.rail-preview .next-card{height:100%;min-height:62px}
    html.rail-preview #unified-search-panel:not([hidden]){position:fixed;top:64px;right:258px;width:min(780px,calc(100vw - 590px));max-height:calc(100vh - 82px);overflow:auto;z-index:1100;background:rgba(14,20,26,.995);border-color:#347da0;box-shadow:0 30px 100px rgba(0,0,0,.7)}
    @media(min-width:1800px){
      html.rail-preview .app-shell{width:min(2200px,calc(100% - 24px))}
      html.rail-preview .layout{grid-template-columns:clamp(310px,17vw,340px) minmax(0,1fr) clamp(238px,13vw,270px)}
      html.rail-preview.admin-locked .layout{grid-template-columns:clamp(310px,17vw,340px) minmax(0,1fr)}
      html.rail-preview .player-stage{height:min(66vh,900px);max-height:calc(100vh - 250px)}
    }
    @media(min-width:2400px){
      html.rail-preview .app-shell{width:min(2500px,calc(100% - 32px))}
      html.rail-preview .layout{grid-template-columns:340px minmax(0,1fr) 280px}
      html.rail-preview.admin-locked .layout{grid-template-columns:340px minmax(0,1fr)}
      html.rail-preview .player-stage{height:min(68vh,1080px);max-height:calc(100vh - 260px)}
    }
    @media(max-height:760px) and (min-width:1180px){
      html.rail-preview .player-stage{height:min(58vh,520px);max-height:calc(100vh - 230px);min-height:280px}
      html.rail-preview .next-card{min-height:54px}
    }
  `;
  document.head.appendChild(style);

  window.addEventListener('webtv:admin-controls-changed',()=>{if(active)moveControls();});
  mq.addEventListener?.('change', applyMode);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode, { once: true });
  else applyMode();
}
