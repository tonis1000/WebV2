import assert from 'node:assert/strict';

const registryModule=await import('../workers/webtv-registry.js?logo-registry-test=1');
const worker=registryModule.default;

function createFakeD1(){
  const overrides=new Map();
  const result=(changes=0)=>({success:true,changes,meta:{changes}});
  const statement=(sql,args=[])=>({
    bind(...next){return statement(sql,next);},
    async run(){
      if(/^CREATE TABLE IF NOT EXISTS channel_logo_overrides/i.test(sql))return result();
      if(/^INSERT INTO channel_logo_overrides/i.test(sql)){
        const [channelId,name,tvgId,country,logoUrl,provider,sourceKind,sourceUrl]=args;
        overrides.set(channelId,{channelId,name,tvgId,country,logoUrl,provider,sourceKind,sourceUrl,updatedAt:'2026-10-03 07:10:00'});
        return result(1);
      }
      throw new Error('Unexpected run SQL: '+sql);
    },
    async all(){
      if(/FROM channel_logo_overrides ORDER BY/i.test(sql))return{results:[...overrides.values()]};
      if(/FROM my_playlist m JOIN channels c/i.test(sql)){
        const saved=overrides.get('crete-tv');
        return{results:[{
          id:'crete-tv',name:'Crete TV',tvgId:'CreteTV.gr',
          logo:saved?.logoUrl||'',
          logoProvider:saved?.provider||null,
          logoSourceKind:saved?.sourceKind||null,
          logoSourceUrl:saved?.sourceUrl||null,
          logoCountry:saved?.country||null,
          groupName:'Περιφερειακά',enabled:1,position:0,addedAt:'2026-10-03 00:00:00'
        }]};
      }
      if(/FROM channel_sources WHERE enabled=1/i.test(sql))return{results:[]};
      throw new Error('Unexpected all SQL: '+sql);
    },
    async first(){throw new Error('Unexpected first SQL: '+sql);}
  });
  return{prepare(sql){return statement(String(sql));},overrides};
}

const DB=createFakeD1();
const env={DB,ADMIN_TOKEN:'logo-test-admin-token',ADMIN_PIN:'123456'};
const base='https://registry.example';
const auth={authorization:`Bearer ${env.ADMIN_TOKEN}`,'content-type':'application/json'};

const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
  const value=String(url);
  if(value.includes('tv-logo/tv-logos')&&value.endsWith('0_all_logos_mosaic.md')){
    return new Response('[crete-tv]:crete-tv-gr.png\n');
  }
  return new Response('',{status:404});
};

try{
  {
    const response=await worker.fetch(new Request(`${base}/api/channel-logos/lookup`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({channelId:'crete-tv',name:'Crete TV',tvgId:'CreteTV.gr',country:'GR'})
    }),env);
    assert.equal(response.status,401,'logo repair writes must require trusted Registry auth');
  }

  {
    const response=await worker.fetch(new Request(`${base}/api/channel-logos/lookup`,{
      method:'POST',headers:auth,
      body:JSON.stringify({channelId:'crete-tv',name:'Crete TV',tvgId:'CreteTV.gr',country:'GR'})
    }),env);
    assert.equal(response.status,200);
    const json=await response.json();
    assert.equal(json.found,true);
    assert.equal(json.override.provider,'tv-logo');
    assert.equal(json.override.sourceKind,'curated-third-party');
    assert.match(json.override.logoUrl,/crete-tv-gr\.png$/);
    assert.equal(DB.overrides.size,1,'only the repaired override should be persisted');
  }

  {
    const response=await worker.fetch(new Request(`${base}/api/channel-logos`),env);
    assert.equal(response.status,200);
    const json=await response.json();
    assert.equal(json.count,1);
    assert.equal(json.overrides[0].channelId,'crete-tv');
    assert.equal(json.overrides[0].provider,'tv-logo');
  }

  {
    const response=await worker.fetch(new Request(`${base}/api/my-playlist`),env);
    assert.equal(response.status,200);
    const json=await response.json();
    assert.equal(json.channels[0].logoProvider,'tv-logo');
    assert.equal(json.channels[0].logoSourceKind,'curated-third-party');
    assert.match(json.channels[0].logo,/crete-tv-gr\.png$/,'My Playlist reload must overlay the sparse D1 repair');
  }
}finally{
  globalThis.fetch=originalFetch;
}

console.log('channel logo Registry persistence contract PASS');
