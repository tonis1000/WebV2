import { candidateForDisplay } from './candidate-model.js';
import { DiscoveryState, FRESHNESS_OPTIONS } from './discovery-state.js';

const BUILD_ID='20260926-discovery-phase1';
const state=new DiscoveryState();
const $=id=>document.getElementById(id);

function ensureStyles(){
  if ($('webtv-discovery-phase1-styles')) return;
  const style=document.createElement('style');
  style.id='webtv-discovery-phase1-styles';
  style.textContent=`
    .button.discovery-beta{background:#1e2736;border-color:#4f7099;color:#d9e9ff}
    .discovery-shell{position:fixed;top:76px;right:18px;width:min(620px,calc(100vw - 28px));max-height:calc(100vh - 92px);overflow:auto;z-index:1100;padding:16px;background:rgba(19,23,28,.995);border:1px solid #4f7099;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.68);color:var(--text)}
    .discovery-shell-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.discovery-shell-head h2{margin:0}.discovery-phase{color:#9ecbff;font-size:.78rem;font-weight:800;letter-spacing:.08em}.discovery-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.discovery-controls button{padding:6px 10px}.discovery-controls button[aria-pressed="true"]{border-color:var(--accent-2);background:#17293b;color:#d9e9ff}.discovery-note{padding:10px 12px;border:1px solid #3c4f65;border-radius:10px;background:#0d141d;color:var(--muted);font-size:.8rem;line-height:1.4}.discovery-results{display:grid;gap:9px;margin-top:12px}.discovery-card{padding:11px;border:1px solid var(--line);border-radius:11px;background:#0b1117}.discovery-card-head{display:flex;justify-content:space-between;gap:10px}.discovery-card strong{font-size:.9rem}.discovery-card span,.discovery-card code{display:block;margin-top:4px;color:var(--muted);font-size:.75rem}.discovery-card code{color:#bfe0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.discovery-status{color:#ffd166;font-weight:800}.discovery-empty{padding:16px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
    @media(max-width:780px){.discovery-shell{top:70px;right:10px;width:calc(100vw - 20px);max-height:calc(100vh - 84px)}}`;
  document.head.appendChild(style);
}

function selectedChannelSnapshot(){
  const channel=window.WebTVPlaylistAPI?.getSelectedChannel?.();
  return channel ? {id:channel.id,originalId:channel.originalId,name:channel.name,group:channel.group} : null;
}

function ensureUi(){
  ensureStyles();
  let button=$('discovery-beta-toggle');
  if (!button) {
    button=document.createElement('button');
    button.id='discovery-beta-toggle';
    button.type='button';
    button.className='button discovery-beta';
    button.textContent='Discovery Beta 🔬';
    const actions=document.querySelector('.topbar-actions');
    const hunt=$('source-hunt-toggle');
    if (actions) actions.insertBefore(button,hunt?.nextSibling||null);
  }
  let panel=$('discovery-shell');
  if (!panel) {
    panel=document.createElement('section');
    panel.id='discovery-shell';
    panel.className='discovery-shell';
    panel.hidden=true;
    panel.setAttribute('aria-label','Source Discovery Phase 1');
    panel.innerHTML=`<div class="discovery-shell-head"><div><div class="discovery-phase">DISCOVERY · PHASE 1</div><h2 id="discovery-channel">No channel selected</h2></div><button id="discovery-close" class="button ghost" type="button">Close</button></div><div class="discovery-note">Local shell only. No external search, verification, playback, persistence or D1 writes run from this panel.</div><div class="discovery-controls" id="discovery-freshness" aria-label="Freshness window"></div><div id="discovery-results" class="discovery-results"></div>`;
    document.body.appendChild(panel);
  }
  const controls=$('discovery-freshness');
  if (controls && !controls.children.length) {
    const label=document.createElement('span');label.textContent='Recent window:';label.className='muted small';controls.appendChild(label);
    for (const option of FRESHNESS_OPTIONS) {
      const control=document.createElement('button');control.type='button';control.className='button ghost';control.dataset.freshness=option.id;control.textContent=option.label;control.addEventListener('click',()=>{state.setFreshness(option.id);render();});controls.appendChild(control);
    }
  }
  if (button.dataset.bound!=='1') {
    button.dataset.bound='1';button.addEventListener('click',openPanel);
    $('discovery-close')?.addEventListener('click',closePanel);
  }
  return {button,panel};
}

function render(){
  const snapshot=state.snapshot();
  const panel=$('discovery-shell');if (!panel) return;
  panel.hidden=!snapshot.open;
  $('discovery-channel').textContent=snapshot.channel?.name || 'No channel selected';
  document.querySelectorAll('#discovery-freshness [data-freshness]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.freshness===snapshot.freshness)));
  const results=$('discovery-results');results.replaceChildren();
  if (!snapshot.channel) {const empty=document.createElement('div');empty.className='discovery-empty';empty.textContent='Select a channel first. Opening Discovery never changes the current selection.';results.appendChild(empty);return;}
  for (const raw of snapshot.candidates) {
    const item=candidateForDisplay(raw);
    const card=document.createElement('article');card.className='discovery-card';
    const head=document.createElement('div');head.className='discovery-card-head';
    const type=document.createElement('strong');type.textContent=item.sourceType.toUpperCase();
    const status=document.createElement('span');status.className='discovery-status';status.textContent=item.verificationStatus;
    head.append(type,status);
    const origin=document.createElement('span');origin.textContent=`Origin: ${item.sourceOrigin} · Match: ${item.matchConfidence}`;
    const url=document.createElement('code');url.textContent=item.sourceUrl;
    card.append(head,origin,url);results.appendChild(card);
  }
}

function openPanel(){
  ensureUi();
  state.setChannel(selectedChannelSnapshot());
  state.setOpen(true);
  render();
}
function closePanel(){state.setOpen(false);render();}

ensureUi();
window.WebTVDiscoveryPhase1=Object.freeze({buildId:BUILD_ID,open:openPanel,close:closePanel,snapshot:()=>state.snapshot()});
console.info(`[WebTV] Discovery Phase 1 shell loaded · ${BUILD_ID} · local only`);
