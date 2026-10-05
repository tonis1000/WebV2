import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const PAGE=process.env.MEDIA_PAGE_URL||'https://tonis1000.github.io/WebV2/media.html';

function runChrome(command,args,{timeoutMs=30000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Chrome timed out\n'+stderr));},timeoutMs);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',status=>{clearTimeout(timer);resolve({status,stdout,stderr});});
  });
}

const chrome=process.env.CHROME_BIN||'google-chrome';
let success=null,last=null;
for(let attempt=1;attempt<=2;attempt++){
  try{
    const run=await runChrome(chrome,[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--window-size=1440,1000','--virtual-time-budget=8000','--dump-dom',
      PAGE+'?verify='+Date.now()+'-'+attempt
    ]);
    const hasCatalog=/class="media-title-card"/.test(run.stdout);
    const hasProvider=/ERTFLIX/.test(run.stdout);
    const hasLoaded=/σειρές από ERTFlix/.test(run.stdout);
    if(run.status===0&&hasCatalog&&hasProvider&&hasLoaded){success=run;break;}
    last=new Error('Production Media page did not render ERTFlix catalog. status='+run.status+'\n'+run.stdout.slice(-12000)+'\n'+run.stderr);
  }catch(error){last=error;}
}
if(!success)throw last||new Error('Media production browser verification failed');
assert.match(success.stdout,/class="media-title-card"/);
assert.match(success.stdout,/σειρές από ERTFlix/);
console.log('media production browser PASS');
