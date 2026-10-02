import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name);
    const st=fs.statSync(full);
    if(st.isDirectory()) out.push(...walk(full));
    else if(/\.(?:js|mjs|html)$/.test(full)) out.push(full.replace(/\\/g,'/'));
  }
  return out;
}

const files=[...walk('src'),'index.html'];
const targets=[
  'source-hunt-engine.js',
  'source-hunt-web.js',
  'source-hunt-discovery-integration.js',
  'source-hunt-enigma2.js',
  'source-hunt-playlist-provenance.js'
];

const refs={};
for(const target of targets){
  refs[target]=[];
  for(const file of files){
    if(file.endsWith('/'+target)) continue;
    const text=fs.readFileSync(file,'utf8');
    const lines=text.split(/\r?\n/);
    lines.forEach((line,i)=>{
      if(line.includes(target)) refs[target].push({file,line:i+1,text:line.trim()});
    });
  }
}

const domStateReads=[];
for(const file of files.filter(f=>f.startsWith('src/'))){
  const text=fs.readFileSync(file,'utf8');
  text.split(/\r?\n/).forEach((line,i)=>{
    if(/(?:channel-name|hunt-channel)/.test(line)&&/(?:textContent|MutationObserver)/.test(line)){
      domStateReads.push({file,line:i+1,text:line.trim()});
    }
  });
}

console.log(JSON.stringify({targets,refs,domStateReads},null,2));
