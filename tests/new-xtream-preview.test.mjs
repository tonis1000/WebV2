import assert from 'node:assert/strict';

const { discoverNewXtreamPreview, NEW_XTREAM_PREVIEW_PROVIDER } = await import('../src/discovery/new-xtream-preview.js');
const { candidateForDisplay } = await import('../src/discovery/candidate-model.js');

const selected={id:'mega',originalId:'MEGA',tvgId:'MEGA',name:'MEGA'};
const credentials={name:'Provider New',server:'https://provider.example',username:'secret-user',password:'secret-pass'};
const result=await discoverNewXtreamPreview(selected,credentials,{
  previewAccount:async input=>{
    assert.deepEqual(input,credentials);
    return{
      previewToken:'opaque-token-123',
      expiresAt:'2099-01-01T00:00:00.000Z',
      account:{name:'Provider New',server:'https://provider.example'},
      channels:[
        {streamId:'501',tvgId:'MEGA',name:'MEGA HD',group:'Greece',playbackUrl:'https://bridge.example/preview-stream/501.m3u8?t=opaque-token-123'},
        {streamId:'999',tvgId:'SKAI',name:'SKAI',group:'Greece',playbackUrl:'https://bridge.example/preview-stream/999.m3u8?t=opaque-token-123'},
      ],
    };
  },
});

assert.equal(result.provider,NEW_XTREAM_PREVIEW_PROVIDER);
assert.equal(result.candidates.length,1);
const candidate=result.candidates[0];
assert.equal(candidate.sourceType,'xtream-preview');
assert.equal(candidate.candidateKind,'xtream-preview');
assert.equal(candidate.saveEligible,false);
assert.equal(candidate.verificationStatus,'UNVERIFIED');
assert.equal(candidate.xtreamStreamId,'501');
assert.equal(candidate.xtreamPreviewToken,'opaque-token-123');
assert.equal(candidate.xtreamPreviewServer,'https://provider.example');
assert.equal(candidate.xtreamPreviewExpiresAt,'2099-01-01T00:00:00.000Z');

const serialized=JSON.stringify(candidate);
assert.equal(serialized.includes('secret-user'),false);
assert.equal(serialized.includes('secret-pass'),false);
const display=candidateForDisplay(candidate);
assert.equal(display.sourceUrl,'[temporary Xtream preview]');
assert.equal(display.xtreamPreviewToken,'[opaque preview token]');
assert.equal(JSON.stringify(display).includes('opaque-token-123'),false);

console.log('new Xtream preview candidate tests PASS');
