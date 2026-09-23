const BUILD_ID = '20260923-0725';
const $ = id => document.getElementById(id);

const panel = $('source-hunt');
const candidateInput = $('candidate-url');
const testButton = $('test-candidate');
const diagSource = $('diag-source');
const diagPlayer = $('diag-player');
const diagStartup = $('diag-startup');
const playbackStatus = $('playback-status');
const diagLog = $('diagnostic-log');

function log(message){
  if(!diagLog) return;
  const stamp = new Date().toLocaleTimeString();
  diagLog.textContent = `[${stamp}] ${message}\n${diagLog.textContent}`.slice(0, 18000);
}

function clean(value=''){
  return String(value || '').split('#')[0].trim();
}

function ensureUi(){
  const runHuntButton = $('run-hunt');
  if(!panel || !runHuntButton) return false;
  if(!$('hunt-oneclick')){
    const heading = panel.querySelector('.section-heading');
    if(!heading) return false;
    const wrap = document.createElement('div');
    wrap.className = 'hunt-oneclick-wrap';
    wrap.innerHTML = `
      <button id="hunt-oneclick" class="button hunt-primary" type="button">Find & Test Best</button>
      <span id="hunt-oneclick-status" class="hunt-oneclick-status">Ready</span>`;
    heading.appendChild(wrap);
  }
  const button = $('hunt-oneclick');
  if(button && button.dataset.oneclickBound !== '1'){
    button.dataset.oneclickBound = '1';
    button.addEventListener('click', runOneClick);
  }
  return true;
}

function collectCandidateUrls(){
  const selectors = [
    '#hunt-results code',
    '#hunt-seed-results code',
    '#hunt-web-results code',
    '#hunt-forum-results code'
  ];
  const seen = new Set();
  const urls = [];
  for(const selector of selectors){
    for(const node of document.querySelectorAll(selector)){
      const url = clean(node.textContent);
      if(!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function waitForDiscovery({maxMs=32000, quietMs=1800, minMs=4500}={}){
  return new Promise(resolve => {
    const roots = [$('hunt-auto'), $('hunt-external')].filter(Boolean);
    const startedAt = Date.now();
    let quietTimer = null;
    let done = false;
    const finish = () => {
      if(done) return;
      done = true;
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      observer.disconnect();
      resolve(collectCandidateUrls());
    };
    const schedule = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        const elapsed = Date.now() - startedAt;
        const urls = collectCandidateUrls();
        if(urls.length && elapsed >= minMs) finish();
        else if(urls.length) quietTimer = setTimeout(finish, Math.max(0, minMs - elapsed));
      }, quietMs);
    };
    const observer = new MutationObserver(schedule);
    roots.forEach(root => observer.observe(root, { childList:true, subtree:true, characterData:true }));
    const maxTimer = setTimeout(finish, maxMs);
    schedule();
  });
}

function waitForPlayback(url, timeoutMs=15000){
  return new Promise(resolve => {
    let done = false;
    const finish = ok => {
      if(done) return;
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      resolve(ok);
    };
    const inspect = () => {
      const source = clean(diagSource?.textContent || '');
      const player = (diagPlayer?.textContent || '').trim();
      const startup = Number.parseInt(diagStartup?.textContent || '', 10) || 0;
      const state = playbackStatus?.classList.contains('live');
      if(source === url && player && player !== '-' && player !== 'failed' && startup > 0 && state) finish(true);
      if(source === url && player === 'failed') finish(false);
    };
    const observer = new MutationObserver(inspect);
    [diagSource, diagPlayer, diagStartup, playbackStatus].filter(Boolean).forEach(node => observer.observe(node, { childList:true, characterData:true,subtree:true,attributes:true }));
    const timer = setTimeout(() => finish(false), timeoutMs);
    inspect();
  });
}

async function runOneClick(){
  const runHuntButton = $('run-hunt');
  const button = $('hunt-oneclick');
  const status = $('hunt-oneclick-status');
  const channelName = $('channel-name')?.textContent?.trim();
  if(!button || !status || !runHuntButton || !candidateInput || !testButton) return;
  if(!channelName || channelName === 'Επίλεξε κανάλι'){
    status.textContent = 'Select a channel first';
    return;
  }

  button.disabled = true;
  status.textContent = `Searching ${channelName}…`;
  log(`ONE-CLICK HUNT START ${channelName}`);

  try{
    document.querySelectorAll('#hunt-results,#hunt-seed-results,#hunt-web-results,#hunt-forum-results').forEach(el => { el.innerHTML = ''; });
    runHuntButton.click();
    const urls = await waitForDiscovery();
    if(!urls.length){
      status.textContent = 'No fresh candidates found';
      log(`ONE-CLICK HUNT ${channelName} · no candidates`);
      return;
    }

    status.textContent = `${urls.length} candidates · testing…`;
    const limit = Math.min(urls.length, 8);
    for(let i=0;i<limit;i++){
      const url = urls[i];
      status.textContent = `Testing ${i+1}/${limit}`;
      candidateInput.value = url;
      candidateInput.dispatchEvent(new Event('input', { bubbles:true }));
      testButton.click();
      log(`ONE-CLICK TEST ${channelName} · ${i+1}/${limit} · ${url}`);
      const ok = await waitForPlayback(url);
      if(ok){
        status.textContent = `Working source found ✓ ${i+1}/${limit}`;
        log(`ONE-CLICK SUCCESS ${channelName} · ${url}`);
        return;
      }
    }

    status.textContent = `No working source in first ${limit}`;
    log(`ONE-CLICK DONE ${channelName} · no working candidate in ${limit}`);
  }catch(error){
    status.textContent = `Failed · ${error.message}`;
    log(`ONE-CLICK ERROR ${channelName} · ${error.message}`);
  }finally{
    button.disabled = false;
  }
}

if(!ensureUi()){
  const observer = new MutationObserver(() => {
    if(ensureUi()) observer.disconnect();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{ensureUi();observer.disconnect();},5000);
}
window.addEventListener('webtv:ready',ensureUi);
console.info(`[WebTV] One-click Source Hunt loaded · build ${BUILD_ID}`);
