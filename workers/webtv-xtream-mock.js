const VERSION = '1.2';
const TEST_PASSWORD = 'test_pass';
const LEGACY_USERNAME = 'test_user';
const SCALE_PROFILES = new Map([
  ['test_50', 50],
  ['test_500', 500],
  ['test_5000', 5000],
]);
const SAMPLE_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(),
      'content-type': 'application/json;charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function profileForUsername(username = '') {
  const user = String(username || '');
  if (user === LEGACY_USERNAME) return { kind: 'legacy', username: user, size: legacyStreams.length };
  const size = SCALE_PROFILES.get(user);
  return size ? { kind: 'scale', username: user, size } : null;
}

function credentialsProfile(url) {
  if (url.searchParams.get('password') !== TEST_PASSWORD) return null;
  return profileForUsername(url.searchParams.get('username'));
}

function userInfo(auth = 1) {
  return {
    auth,
    status: auth ? 'Active' : 'Disabled',
    exp_date: '1893456000',
    is_trial: '0',
    active_cons: '0',
    created_at: '1790370000',
    max_connections: '2',
    allowed_output_formats: ['m3u8', 'ts'],
  };
}

function serverInfo(url) {
  return {
    url: url.hostname,
    port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    https_port: '443',
    server_protocol: url.protocol.replace(':', ''),
    timezone: 'Europe/Athens',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString(),
  };
}

const legacyCategories = [
  { category_id: '10', category_name: 'WebTV Test · News', parent_id: 0 },
  { category_id: '20', category_name: 'WebTV Test · Sports', parent_id: 0 },
  { category_id: '30', category_name: 'WebTV Test · Movies', parent_id: 0 },
  { category_id: '40', category_name: 'Greece', parent_id: 0 },
];

const legacyStreams = [
  { num: 1, name: 'WebTV Test News', stream_type: 'live', stream_id: 1001, stream_icon: '', epg_channel_id: 'webtv.test.news', added: '1790370000', category_id: '10', custom_sid: '', tv_archive: 0, direct_source: '', tv_archive_duration: 0 },
  { num: 2, name: 'WebTV Test Sports', stream_type: 'live', stream_id: 1002, stream_icon: '', epg_channel_id: 'webtv.test.sports', added: '1790370000', category_id: '20', custom_sid: '', tv_archive: 0, direct_source: '', tv_archive_duration: 0 },
  { num: 3, name: 'WebTV Test Movies', stream_type: 'live', stream_id: 1003, stream_icon: '', epg_channel_id: 'webtv.test.movies', added: '1790370000', category_id: '30', custom_sid: '', tv_archive: 0, direct_source: '', tv_archive_duration: 0 },
  { num: 4, name: 'MEGA', stream_type: 'live', stream_id: 1101, stream_icon: '', epg_channel_id: 'mega.gr', added: '1790370000', category_id: '40', custom_sid: '', tv_archive: 0, direct_source: '', tv_archive_duration: 0 },
];

function scaleCategoryCount(size) {
  if (size <= 50) return 5;
  if (size <= 500) return 8;
  return 10;
}

function scaleCategories(size) {
  return Array.from({ length: scaleCategoryCount(size) }, (_, index) => ({
    category_id: String(100 + index),
    category_name: `WebTV Scale ${size} · Group ${index + 1}`,
    parent_id: 0,
  }));
}

function scaleStreamId(size, index) {
  return size * 1000 + index;
}

function scaleStreams(size) {
  const categoryCount = scaleCategoryCount(size);
  return Array.from({ length: size }, (_, offset) => {
    const index = offset + 1;
    return {
      num: index,
      name: `WebTV ${size} Channel ${String(index).padStart(4, '0')}`,
      stream_type: 'live',
      stream_id: scaleStreamId(size, index),
      stream_icon: '',
      epg_channel_id: `webtv.test.${size}.${String(index).padStart(4, '0')}`,
      added: '1790370000',
      category_id: String(100 + (offset % categoryCount)),
      custom_sid: '',
      tv_archive: 0,
      direct_source: '',
      tv_archive_duration: 0,
    };
  });
}

function categoriesFor(profile) {
  return profile?.kind === 'legacy' ? legacyCategories : scaleCategories(profile?.size || 0);
}

function streamsFor(profile) {
  return profile?.kind === 'legacy' ? legacyStreams : scaleStreams(profile?.size || 0);
}

function profileContainsStream(profile, streamId) {
  const id = Number(streamId);
  if (!Number.isInteger(id)) return false;
  if (profile?.kind === 'legacy') return legacyStreams.some(stream => stream.stream_id === id);
  if (profile?.kind !== 'scale') return false;
  const first = scaleStreamId(profile.size, 1);
  const last = scaleStreamId(profile.size, profile.size);
  return id >= first && id <= last;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/api/status') {
      return json({
        ok: true,
        service: 'WebTV Xtream Test Provider',
        version: VERSION,
        username: LEGACY_USERNAME,
        channels: legacyStreams.length,
        scaleProfiles: Object.fromEntries(SCALE_PROFILES),
      });
    }

    if (path === '/player_api.php') {
      const profile = credentialsProfile(url);
      if (!profile) return json({ user_info: userInfo(0), server_info: serverInfo(url) });

      const action = url.searchParams.get('action') || '';
      if (!action) return json({ user_info: userInfo(1), server_info: serverInfo(url) });
      if (action === 'get_live_categories') return json(categoriesFor(profile));
      if (action === 'get_live_streams') return json(streamsFor(profile));
      if (action === 'get_short_epg') return json({ epg_listings: [] });
      return json([]);
    }

    const live = path.match(/^\/live\/([^/]+)\/([^/]+)\/([^/.]+)\.(?:m3u8|ts)$/);
    if (live) {
      const [, usernameRaw, passwordRaw, streamIdRaw] = live;
      const username = decodeURIComponent(usernameRaw);
      const password = decodeURIComponent(passwordRaw);
      const profile = password === TEST_PASSWORD ? profileForUsername(username) : null;
      if (!profile) return json({ error: 'Invalid test credentials' }, 401);
      if (!profileContainsStream(profile, decodeURIComponent(streamIdRaw))) return json({ error: 'Unknown test stream' }, 404);
      return Response.redirect(SAMPLE_HLS, 302);
    }

    return json({ error: 'Not found' }, 404);
  },
};
