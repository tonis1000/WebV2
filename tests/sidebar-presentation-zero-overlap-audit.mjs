import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name);
    const st=fs.statSync(full);
    if(st.isDirectory()) out.push(...walk(full));
    else if(full.endsWith('.js')) out.push(full.replace(/\\/g,'/'));
  }
  return out;
}

const files=walk('src');
const patterns=[
  ['channel-list', /channel-list/g],
  ['channel-item', /channel-item/g],
  ['channel-now-inline', /channel-now-inline/g],
  ['channel-summary', /channel-summary/g],
  ['channel-name', /channel-name/g],
  ['MutationObserver', /MutationObserver/g],
  ['appendChild', /appendChild\s*\(/g],
  ['prepend', /\.prepend\s*\(/g],
  ['insertBefore', /insertBefore\s*\(/g],
  ['replaceChildren', /replaceChildren\s*\(/g],
  ['hidden-write', /\.hidden\s*=/g],
  ['class-write', /classList\.(?:add|remove|toggle)\s*\(/g],
  ['epg-event', /webtv:epg-updated/g],
  ['selection-event', /webtv:channel-selected/g],
  ['favorites-event', /webtv:favorites-presentation-changed/g],
  ['epg-get', /\.get\s*\(\s*channel\s*\)/g],
  ['epg-refresh', /epg\.refresh\s*\(/g],
];

const findings=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const lines=text.split(/\r?\n/);
  for(const [label,re] of patterns){
    let count=0;
    for(let i=0;i<lines.length;i++){
      re.lastIndex=0;
      if(re.test(lines[i])){
        count++;
        findings.push({file,label,line:i+1,text:lines[i].trim().slice(0,240)});
      }
    }
  }
}

const filesFor=label=>[...new Set(findings.filter(x=>x.label===label).map(x=>x.file))].sort();

const nowOwners=filesFor('channel-now-inline');
const summaryOwners=filesFor('channel-summary');
const refreshOwners=filesFor('epg-refresh');
const channelListReaders=filesFor('channel-list');

const expectedNowOwners=['src/sidebar-now.js'];
const expectedSummaryOwners=['src/main.js'];
const expectedRefreshOwners=['src/main.js'];
const allowedChannelListReaders=[
  'src/main.js',
  'src/sidebar-now.js',
  'src/xtream-preview-actions.js',
  'src/xtream-ui.js'
].sort();

function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
if(!same(nowOwners,expectedNowOwners)) throw new Error(`Unexpected Now Playing owner(s): ${JSON.stringify(nowOwners)}`);
if(!same(summaryOwners,expectedSummaryOwners)) throw new Error(`Unexpected channel summary owner(s): ${JSON.stringify(summaryOwners)}`);
if(!same(refreshOwners,expectedRefreshOwners)) throw new Error(`Unexpected EPG refresh owner(s): ${JSON.stringify(refreshOwners)}`);
if(!same(channelListReaders,allowedChannelListReaders)) throw new Error(`Unexpected channel-list consumer(s): ${JSON.stringify(channelListReaders)}`);

for(const file of ['src/xtream-preview-actions.js','src/xtream-ui.js']){
  const text=fs.readFileSync(file,'utf8');
  if(/(?:channel-list|channel-item)[\\s\\S]{0,400}(?:appendChild|prepend|insertBefore|replaceChildren|\\.hidden\\s*=)/.test(text)){
    throw new Error(`${file} appears to mutate Sidebar row roots instead of reading them`);
  }
}
{
  const text=fs.readFileSync('src/right-rail-preview.js','utf8');
  if(/channel-list|channel-item|channel-now-inline/.test(text)){
    throw new Error('right-rail-preview.js must not own Sidebar channel-row presentation');
  }
}
{
  const text=fs.readFileSync('src/route-tooltip.js','utf8');
  if(/channel-list/.test(text)||/appendChild\\s*\\(|insertBefore\\s*\\(|replaceChildren\\s*\\(|\\.hidden\\s*=/.test(text)){
    throw new Error('route-tooltip.js must remain a read-only channel-row consumer');
  }
}

console.log(JSON.stringify({
  scannedFiles:files.length,
  findingCount:findings.length,
  nowOwners,
  summaryOwners,
  refreshOwners,
  channelListReaders,
  zeroOverlap:true,
  findings
},null,2));
