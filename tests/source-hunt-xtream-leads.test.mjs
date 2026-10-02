import assert from 'node:assert/strict';
import { buildQueries, safeXtreamProviderLeadUrl, xtreamProviderEvidence } from '../workers/source-huntatonisworkersdev.js';

const megaQueries=buildQueries('MEGA');
assert.equal(megaQueries.length,3,'Source Hunt query budget stays at three Brave searches');
const xtream=megaQueries.find(item=>item.kind==='xtream');
assert.ok(xtream,'Source Hunt must include one Xtream provider/trial query');
assert.match(xtream.q,/Xtream Codes/i);
assert.match(xtream.q,/trial/i);
assert.match(xtream.q,/Greek IPTV/i);
assert.equal(/MEGA|Mega Channel/i.test(xtream.q),false,'provider discovery must not require a provider page to mention the current channel');

const evidence=xtreamProviderEvidence('Greek IPTV with MEGA, ANT1 and SKAI. M3U or Xtream Codes login. Free trial available.','MEGA');
assert.equal(evidence.qualifies,true);
assert.equal(evidence.xtream,true);
assert.equal(evidence.greek,true);
assert.equal(evidence.trial,true);
const playerArticle=xtreamProviderEvidence('IPTV player supports English, Greek and Spanish. Xtream Codes supported. Free trial of the app.','MEGA');
assert.equal(playerArticle.qualifies,false,'language support alone must not look like Greek-channel provider evidence');

const provider=safeXtreamProviderLeadUrl('https://provider.example/greek-iptv/free-trial');
assert.equal(provider,'https://provider.example/greek-iptv/free-trial');
assert.equal(safeXtreamProviderLeadUrl('https://provider.example/get.php?username=demo&password=secret&type=m3u'),'','credential-bearing Xtream URLs must never become provider leads');
assert.equal(safeXtreamProviderLeadUrl('https://demo:secret@provider.example/player_api.php'),'','embedded credentials must never become provider leads');

console.log('Source Hunt Xtream provider/trial lead contract PASS');
