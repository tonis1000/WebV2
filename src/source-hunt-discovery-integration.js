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
`;
document.head.appendChild(style);

async function integrateDiscoveryIntoSourceHunt(){
  await import('./discovery/discovery-ui.js?v=20260927-source-hunt-integrated');

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
  shell.setAttribute('aria-label','Source Hunt search sources and Xtream tools');

  const note = shell.querySelector('.discovery-note');
  if(note){
    note.textContent = 'Search sources and verification stay isolated from normal playback until you explicitly test or save a result. New Xtream logins use a short-lived encrypted preview; after VERIFIED you choose whether to add only that channel or save the full Xtream account.';
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
  console.info('[WebTV] Discovery tools integrated into Source Hunt · Beta UI hidden');
}

integrateDiscoveryIntoSourceHunt().catch(error=>console.warn('[WebTV] Source Hunt discovery integration failed',error));
