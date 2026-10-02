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

console.log(JSON.stringify({
  scannedFiles:files.length,
  findingCount:findings.length,
  files:[...new Set(findings.map(x=>x.file))],
  findings
},null,2));
