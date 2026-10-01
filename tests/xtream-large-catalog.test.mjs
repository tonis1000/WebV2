import assert from 'node:assert/strict';
import worker from '../workers/webtv-xtream-mock.js';
import { filterXtreamChannels, pageXtreamChannels, XTREAM_PAGE_SIZE } from '../src/xtream-catalog-view.js';

async function provider(path){
  const response=await worker.fetch(new Request(`https://mock.test${path}`));
  const body=await response.json();
  return {response,body};
}

for(const size of [50,500,5000]){
  const username=`test_${size}`;
  const login=await provider(`/player_api.php?username=${username}&password=test_pass`);
  assert.equal(String(login.body.user_info?.auth),'1',`${username} must authenticate`);
  const cats=await provider(`/player_api.php?username=${username}&password=test_pass&action=get_live_categories`);
  const streams=await provider(`/player_api.php?username=${username}&password=test_pass&action=get_live_streams`);
  assert.equal(streams.body.length,size,`${username} must return ${size} streams`);
  assert.ok(cats.body.length>=4,'large fixtures should span multiple deterministic groups');
  assert.equal(streams.body[0].epg_channel_id,`webtv.test.${size}.0001`);
  assert.equal(streams.body.at(-1).epg_channel_id,`webtv.test.${size}.${String(size).padStart(4,'0')}`);

  const normalized=streams.body.map(row=>({streamId:String(row.stream_id),name:row.name,group:String(row.category_id),tvgId:row.epg_channel_id}));
  const filtered=filterXtreamChannels(normalized,{group:String(streams.body[0].category_id),query:'Channel'});
  const page=pageXtreamChannels(filtered,0);
  assert.ok(page.length<=XTREAM_PAGE_SIZE,`catalog view must never expose more than ${XTREAM_PAGE_SIZE} rows per page`);
}

const legacy=await provider('/player_api.php?username=test_user&password=test_pass&action=get_live_streams');
assert.equal(legacy.body.length,4,'legacy test_user fixture must remain 4 channels');
assert.equal(legacy.body[3].name,'MEGA');
assert.equal(legacy.body[3].stream_id,1101);

const playback=await worker.fetch(new Request('https://mock.test/live/test_5000/test_pass/5000001.m3u8'));
assert.equal(playback.status,302,'generated stream must redirect to sample HLS');
assert.match(playback.headers.get('location')||'',/test-streams\.mux\.dev/);

console.log('Xtream large-catalog tests PASS');
