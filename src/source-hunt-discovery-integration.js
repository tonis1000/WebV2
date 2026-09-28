const $ = id => document.getElementById(id);

const style = document.createElement('style');
style.id = 'source-hunt-discovery-integration-styles';
style.textContent = `
  #discovery-beta-toggle{display:none!important}
  #source-hunt #discovery-shell.source-hunt-discovery-integrated{
    position:static!important;
    top:auto!important;
    right:auto!important;
    width:100%!important;
    max-width:none!important;
    max-height:none!important;
    overflow:visible!important;
    z-index:auto!important;
    margin:12px 0 0!important;
    padding:12px!important;
    box-shadow:none!important;
    border-radius:12px!important;
  }
  #source-hunt #discovery-shell.source-hunt-discovery-integrated .discovery-shell-head{
    display:none!important;
  }
  #source-hunt #discovery-shell.source-hunt-discovery-integrated .discovery-note{
    margin-top:0!important;
  }
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-freshness,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-local,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-curated,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-github,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-web,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-strm,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-official,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-scan-xtream,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-cancel-external,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-verify-all,
  #source-hunt #discovery-shell.source-hunt-discovery-integrated #discovery-cancel-verify{
    display:none!important;
  }
`;
document.head.appendChild(style);

async function integrateDiscoveryIntoSourceHunt(){
  await import('./discovery/discovery-ui.js?v=20260928-source-hunt-unified');
  await import('./source-hunt-playlist-provenance.js?v=20260928-source-playlists2');

  const sourceHunt = $('source-hunt');
  const toggle = $('source-hunt-toggle');
  const shell = $('discovery-shell');
  const betaButton = $('discovery-beta-toggle');
  const huntChannel = $('hunt-channel');
  const api = window.WebTVDiscovery;

  if(!sourceHunt || !shell || !api) return;

  if(betaButton){
    betaButton.hidden = true;
    betaButton.setAttribute('aria-hidden','true');
    betaButton.tabIndex = -1;
  }

  shell.classList.add('source-hunt-discovery-integrated');
  shell.setAttribute('aria-label','Source Hunt Xtream tools and unified discovery results');

  const note = shell.querySelector('.discovery-note');
  if(note){
    note.textContent = 'Find & Test Best searches Local, Curated, GitHub, Recent Web, STRM, Official and Authorized Xtream sources, merges duplicates, uses verifier results as diagnostics, then lets real browser playback choose the winner. Nothing is saved until a source actually plays. New Xtream login testing stays explicit and secure below.';
  }
  const hint = shell.querySelector('.discovery-new-xtream-hint');
  if(hint){
    hint.textContent = 'Username/password are sent directly to the secure Xtream bridge and cleared from these fields after the test. Source Hunt keeps only an opaque short-lived preview token.';
  }

  const heading = sourceHunt.querySelector('.section-heading .eyebrow');
  if(heading) heading.textContent = 'SOURCE HUNT';

  const directTester = [...sourceHunt.children].find(node => node.classList?.contains('candidate-tester')) || null;
  if(directTester) sourceHunt.insertBefore(shell,directTester);
  else sourceHunt.appendChild(shell);

  const sync = () => {
    if(sourceHunt.hidden){
      api.close?.();
      return;
    }
    api.open?.();
  };

  toggle?.addEventListener('click',()=>setTimeout(sync,0));
  new MutationObserver(sync).observe(sourceHunt,{attributes:true,attributeFilter:['hidden']});
  if(huntChannel){
    new MutationObserver(()=>{if(!sourceHunt.hidden) api.open?.();}).observe(huntChannel,{childList:true,subtree:true,characterData:true});
  }

  if(!sourceHunt.hidden) sync();
  console.info('[WebTV] Unified Discovery integrated into Source Hunt · manual lane buttons hidden · Xtream preview retained · playlist provenance enabled');
}

integrateDiscoveryIntoSourceHunt().catch(error=>console.warn('[WebTV] Source Hunt discovery integration failed',error));
