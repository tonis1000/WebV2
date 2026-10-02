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
function norm(from,spec){
  if(!spec.startsWith('.')) return null;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
  return resolved.endsWith('.js')?resolved:resolved+'.js';
}

const files=walk('src').sort();
const index=fs.readFileSync('index.html','utf8');
const texts=new Map(files.map(f=>[f,fs.readFileSync(f,'utf8')]));

const inbound=new Map(files.map(f=>[f,[]]));
for(const file of files){
  const text=texts.get(file);
  const specs=[...text.matchAll(/(?:import\s+(?:[^'"]*?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
  for(const spec of specs){
    const target=norm(file,spec);
    if(target && inbound.has(target)) inbound.get(target).push({from:file,kind:'import',spec});
  }
}
for(const file of files){
  const rel=file.replace(/^src\//,'');
  const base=path.posix.basename(file);
  const patterns=[
    'src/'+rel,
    './src/'+rel,
    rel,
    base
  ];
  for(const pat of patterns){
    if(index.includes(pat)){
      inbound.get(file).push({from:'index.html',kind:'entrypoint',spec:pat});
      break;
    }
  }
}

const zeroInbound=files.filter(f=>inbound.get(f).length===0);

const rawInbound={};
for(const target of files){
  const rel=target.replace(/^src\//,'');
  const base=path.posix.basename(target);
  const refs=[];
  const probes=[target,'./'+target,rel,'./'+rel,base];
  for(const [from,text] of [['index.html',index],...texts.entries()]){
    if(from===target) continue;
    const hit=probes.find(p=>text.includes(p));
    if(hit) refs.push({from,spec:hit});
  }
  rawInbound[target]=refs;
}
const strongZeroInbound=zeroInbound.filter(f=>rawInbound[f].length===0);

function walkSelected(dir,exts){
  if(!fs.existsSync(dir)) return [];
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name);
    const st=fs.statSync(full);
    if(st.isDirectory()) out.push(...walkSelected(full,exts));
    else if(exts.some(ext=>full.endsWith(ext))) out.push(full.replace(/\\/g,'/'));
  }
  return out;
}
const workerFiles=walkSelected('workers',['.js']);
const testFiles=walkSelected('tests',['.js','.mjs']);
const workflowFiles=walkSelected('.github/workflows',['.yml','.yaml']);
const externalTexts=[
  ...workerFiles.map(f=>({scope:'worker-runtime',file:f,text:fs.readFileSync(f,'utf8')})),
  ...testFiles.map(f=>({scope:'tests-only',file:f,text:fs.readFileSync(f,'utf8')})),
  ...workflowFiles.map(f=>({scope:'workflow',file:f,text:fs.readFileSync(f,'utf8')}))
];
const candidateScopeRefs={};
for(const target of strongZeroInbound){
  const rel=target.replace(/^src\//,'');
  const base=path.posix.basename(target);
  const probes=[target,'./'+target,rel,'./'+rel,base];
  const refs=[];
  for(const item of externalTexts){
    const hit=probes.find(p=>item.text.includes(p));
    if(hit) refs.push({scope:item.scope,file:item.file,spec:hit});
  }
  candidateScopeRefs[target]=refs;
}
const fullyUnreferenced=strongZeroInbound.filter(f=>candidateScopeRefs[f].length===0);

const globalOwners={};
for(const file of files){
  const text=texts.get(file);
  const names=new Set([
    ...[...text.matchAll(/window\.(WebTV[A-Za-z0-9_$]+)\s*=/g)].map(m=>m[1]),
    ...[...text.matchAll(/window\[['"](WebTV[A-Za-z0-9_$]+)['"]\]\s*=/g)].map(m=>m[1])
  ]);
  for(const name of names){
    (globalOwners[name]??=[]).push(file);
  }
}
const duplicateGlobals=Object.fromEntries(Object.entries(globalOwners).filter(([,owners])=>owners.length>1));

const writers=[];
const endpoints=['/api/my-playlist','/api/favorites','/api/saved-playlists','/api/custom-playlists','/api/xtream'];
for(const file of files){
  const lines=texts.get(file).split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(endpoints.some(ep=>line.includes(ep)) && /fetch\s*\(|method\s*:|PUT|POST|DELETE|PATCH/.test(line)){
      writers.push({file,line:i+1,text:line.trim().slice(0,260)});
    }
  });
}

const mutationObservers=[];
const domTextState=[];
for(const file of files){
  const lines=texts.get(file).split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(/new\s+MutationObserver\s*\(/.test(line)) mutationObservers.push({file,line:i+1,text:line.trim().slice(0,220)});
    if(/(?:getElementById|querySelector)[^\n]{0,180}(?:textContent|innerText)|(?:textContent|innerText)[^\n]{0,180}(?:getElementById|querySelector)/.test(line)){
      domTextState.push({file,line:i+1,text:line.trim().slice(0,260)});
    }
  });
}

const eventOwners={};
for(const file of files){
  const text=texts.get(file);
  for(const m of text.matchAll(/(?:CustomEvent\s*\(\s*|addEventListener\s*\(\s*)['"](webtv:[^'"]+)['"]/g)){
    const ev=m[1];
    (eventOwners[ev]??=new Set()).add(file);
  }
}
const events=Object.fromEntries(Object.entries(eventOwners).map(([k,v])=>[k,[...v].sort()]));

const report={
  scannedFiles:files.length,
  zeroInbound,
  zeroInboundCount:zeroInbound.length,
  rawInboundForZero:Object.fromEntries(zeroInbound.map(f=>[f,rawInbound[f]])),
  strongZeroInbound,
  strongZeroInboundCount:strongZeroInbound.length,
  candidateScopeRefs,
  fullyUnreferenced,
  fullyUnreferencedCount:fullyUnreferenced.length,
  duplicateGlobals,
  duplicateGlobalCount:Object.keys(duplicateGlobals).length,
  writers,
  mutationObservers,
  domTextState,
  events
};
console.log(JSON.stringify(report,null,2));
