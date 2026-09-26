import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const requested=pathname==='/'?'/tests/discovery-browser-smoke.html':pathname;
  const file=path.resolve(repoRoot,`.${requested}`);
  if(!file.startsWith(repoRoot+path.sep)){res.writeHead(403).end('forbidden');return;}
  try{
    const data=fs.readFileSync(file);
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end(data);
  }catch{res.writeHead(404).end('not found');}
});

function runChrome(command,args,{timeoutMs=20000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      reject(new Error(`Chrome timed out after ${timeoutMs} ms\n${stderr}`));
    },timeoutMs);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',status=>{clearTimeout(timer);resolve({status,stdout,stderr});});
  });
}

await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
try{
  const chrome=process.env.CHROME_BIN || 'google-chrome';
  const args=[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--virtual-time-budget=3000','--dump-dom','http://127.0.0.1:4173/tests/discovery-browser-smoke.html'
  ];

  let successfulRun=null;
  let lastFailure=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const run=await runChrome(chrome,args,{timeoutMs:20000});
      const hasPass=/data-phase4-result="PASS"/.test(run.stdout);
      if(run.status===0&&hasPass){
        successfulRun=run;
        break;
      }
      lastFailure=new Error(`Chrome attempt ${attempt} did not produce PASS. status=${run.status}\nDOM:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }catch(error){
      lastFailure=error;
    }
    if(attempt<2)console.warn(`Discovery browser smoke attempt ${attempt} failed; retrying once: ${lastFailure?.message||lastFailure}`);
  }

  if(!successfulRun)throw lastFailure||new Error('Discovery browser smoke failed without a result');
  assert.match(successfulRun.stdout,/data-phase4-result="PASS"/);
  assert.match(successfulRun.stdout,/SIDEBAR-STABLE/);
  assert.match(successfulRun.stdout,/PLAYER-STABLE/);
  console.log('discovery Phase 4 browser smoke PASS');
}finally{
  await new Promise(resolve=>server.close(resolve));
}
