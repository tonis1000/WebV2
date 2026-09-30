import assert from 'node:assert/strict';
import { parseEnigma2Bouquet } from '../src/core/enigma2-core.js';

function serviceByDescription(result, description) {
  return result.services.find(service => service.description === description);
}

{
  const parsed = parseEnigma2Bouquet(`#NAME Greek IPTV\n#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3A//example.com/live/master.m3u8:ERT 1\n#DESCRIPTION ERT1\n`);
  assert.equal(parsed.name, 'Greek IPTV');
  assert.equal(parsed.services.length, 1);
  assert.deepEqual(parsed.services[0], {
    lineIndex: 1,
    rawService: '#SERVICE 4097:0:1:0:0:0:0:0:0:0:http%3A//example.com/live/master.m3u8:ERT 1',
    serviceType: '4097',
    rawReference: 'http%3A//example.com/live/master.m3u8',
    decodedReference: 'http://example.com/live/master.m3u8',
    inlineName: 'ERT 1',
    description: 'ERT1',
    descriptionLineIndex: 2,
  });
}

{
  const parsed = parseEnigma2Bouquet(`#SERVICE 5001:0:1:0:0:0:0:0:0:0:https%253A//cdn.example.com/live/index.mpd%257CUser-Agent%253DWebTV%2520Test:MEGA HD\n#DESCRIPTION MEGA\n`);
  assert.equal(parsed.services.length, 1);
  const service = parsed.services[0];
  assert.equal(service.serviceType, '5001');
  assert.equal(service.rawReference, 'https%253A//cdn.example.com/live/index.mpd%257CUser-Agent%253DWebTV%2520Test');
  assert.equal(service.decodedReference, 'https://cdn.example.com/live/index.mpd|User-Agent=WebTV Test');
  assert.equal(service.inlineName, 'MEGA HD');
  assert.equal(service.description, 'MEGA');
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
  assert.equal(parsed.services[0].decodedReference, 'not-a-url');
}

console.log('Enigma2 core contract passed');
