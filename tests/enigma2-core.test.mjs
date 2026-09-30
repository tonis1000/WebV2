import assert from 'node:assert/strict';
import { parseEnigma2Bouquet } from '../src/core/enigma2-core.js';

function serviceByDescription(result, description) {
  return result.services.find(service => service.description === description);
}

{
  const parsed = parseEnigma2Bouquet(`#NAME Greek IPTV\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3A//example.com/live/master.m3u8:ERT 1\n#DESCRIPTION ERT1\n`);
  assert.equal(parsed.name, 'Greek IPTV');
  assert.equal(parsed.services.length, 1);
  const service=parsed.services[0];
  assert.equal(service.serviceType,'4097');
  assert.equal(service.rawReference,'http%3A//example.com/live/master.m3u8');
  assert.equal(service.decodedReferenceOnce,'http://example.com/live/master.m3u8');
  assert.equal(service.decodedReference,'http://example.com/live/master.m3u8');
  assert.equal(service.rawInlineName,'ERT 1');
  assert.equal(service.inlineNameDecodedOnce,'ERT 1');
  assert.equal(service.inlineName,'ERT 1');
  assert.equal(service.rawDescription,'ERT1');
  assert.equal(service.description,'ERT1');
  assert.equal(service.descriptionLineIndex,2);
  assert.equal(service.embeddedReference,'http://example.com/live/master.m3u8');
  assert.equal(service.embeddedInlineName,'ERT 1');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 5001:0:1:0:0:0:0:0:0:0:https%253A//cdn.example.com/live/index.mpd%257CUser-Agent%253DWebTV%2520Test:MEGA%2520HD\n#DESCRIPTION MEGA%2520NEWS\n`);
  const service = parsed.services[0];
  assert.equal(service.decodedReferenceOnce, 'https%3A//cdn.example.com/live/index.mpd%7CUser-Agent%3DWebTV%20Test');
  assert.equal(service.decodedReference, 'https://cdn.example.com/live/index.mpd|User-Agent=WebTV Test');
  assert.equal(service.rawInlineName, 'MEGA%2520HD');
  assert.equal(service.inlineNameDecodedOnce, 'MEGA%20HD');
  assert.equal(service.inlineName, 'MEGA HD');
  assert.equal(service.rawDescription, 'MEGA%2520NEWS');
  assert.equal(service.description, 'MEGA NEWS');
  assert.equal(service.embeddedReference, '', 'legacy frontend scheme recognition does not discover a double-encoded %253A scheme before decoding');
  assert.equal(service.embeddedInlineName, '');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 5001:0:1:0:0:0:0:0:0:0:https%3A//cdn.example.com/live/index.mpd%7CUser-Agent%3DWebTV%20Test:MEGA%20HD\n#DESCRIPTION MEGA\n`);
  const service=parsed.services[0];
  assert.equal(service.embeddedReference,'https://cdn.example.com/live/index.mpd|User-Agent=WebTV Test');
  assert.equal(service.embeddedInlineName,'MEGA HD');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 4097:0:1:0:0:0:0:0:0:0:https://cdn.example.com/live/index.m3u8:SKAI\n#DESCRIPTION SKAI\n`);
  const service=parsed.services[0];
  assert.equal(service.rawReference,'https','fixed-field facts remain available for Discovery parity');
  assert.equal(service.embeddedReference,'https://cdn.example.com/live/index.m3u8','embedded scheme facts preserve frontend-compatible literal URLs');
  assert.equal(service.embeddedInlineName,'SKAI');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 4097:0:https%3A//compact.example/live/master.m3u8:Compact\n#DESCRIPTION Compact channel\n`);
  assert.equal(parsed.services.length,1,'frontend-compatible compact SERVICE forms are retained even without eleven fixed Enigma fields');
  const service=parsed.services[0];
  assert.equal(service.serviceType,'4097');
  assert.equal(service.rawReference,'','fixed-field reference is absent rather than invented');
  assert.equal(service.embeddedReference,'https://compact.example/live/master.m3u8');
  assert.equal(service.embeddedInlineName,'Compact');
  assert.equal(service.description,'Compact channel');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 1:0:1:0:0:0:0:0:0:0:rtsp%3A//camera.example.com/live:Camera\n#DESCRIPTION Camera feed\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:rtmp%3A//media.example.com/live:Legacy\n#DESCRIPTION Legacy feed\n`);
  assert.equal(parsed.services.length, 2, 'neutral parser must preserve structurally valid services regardless of product support');
  assert.equal(serviceByDescription(parsed, 'Camera feed').decodedReference, 'rtsp://camera.example.com/live');
  assert.equal(serviceByDescription(parsed, 'Legacy feed').decodedReference, 'rtmp://media.example.com/live');
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3A//one.example/live:One\n#COMMENT unrelated\n#DESCRIPTION One description\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3A//two.example/live:Two\n#DESCRIPTION Two description\n`);
  assert.equal(parsed.services.length, 2);
  assert.equal(parsed.services[0].description, '', 'DESCRIPTION is associated only when it immediately follows a SERVICE line');
  assert.equal(parsed.services[1].description, 'Two description');
}

{
  const parsed = parseEnigma2Bouquet(`#NAME Mixed\r\n#SERVICE broken\r\n#DESCRIPTION Broken\r\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:not-a-url:Label\r\n`);
  assert.equal(parsed.name, 'Mixed');
  assert.equal(parsed.services.length, 1, 'malformed SERVICE structure is skipped, structurally parseable references are preserved neutrally');
  assert.equal(parsed.services[0].rawReference, 'not-a-url');
  assert.equal(parsed.services[0].decodedReferenceOnce, 'not-a-url');
  assert.equal(parsed.services[0].decodedReference, 'not-a-url');
  assert.equal(parsed.services[0].embeddedReference,'');
}

console.log('Enigma2 core contract passed');
