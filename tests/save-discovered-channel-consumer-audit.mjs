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
const symbol='saveDiscoveredChannel';
const hits=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const lines=text.split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(line.includes(symbol)) hits.push({file,line:i+1,text:line.trim()});
  });
}

const consumers=hits.filter(h=>h.file!=='src/playlist-manager.js');
console.log(JSON.stringify({
  scannedFiles:files.length,
  symbol,
  hits,
  consumers,
  consumerCount:consumers.length
},null,2));

if(consumers.length!==0){
  throw new Error('Expected zero active consumers for saveDiscoveredChannel');
}
