const VERSION = '1.1';
const TEST_USERNAME = 'test_user';
const TEST_PASSWORD = 'test_pass';
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

function validCredentials(url) {
  return url.searchParams.get('username') === TEST_USERNAME && url.searchParams.get('password') === TEST_PASSWORD;
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

const categories = [
  { category_id: '10', category_name: 'WebTV Test · News', parent_id: 0 },
  { category_id: '20', category_name: 'WebTV Test · Sports', parent_id: 0 },
  { category_id: '30', category_name: 'WebTV Test · Movies', parent_id: 0 },
  { category_id: '40', category_name: 'Greece', parent_id: 0 },
];

const streams = [
  {
    num: 1,
    name: 'WebTV Test News',
    stream_type: 'live',
    stream_id: 1001,
    stream_icon: '',
    epg_channel_id: 'webtv.test.news',
    added: '1790370000',
    category_id: '10',
    custom_sid: '',
    tv_archive: 0,
    direct_source: '',
    tv_archive_duration: 0,
  },
  {
    num: 2,
    name: 'WebTV Test Sports',
    stream_type: 'live',
    stream_id: 1002,
    stream_icon: '',
    epg_channel_id: 'webtv.test.sports',
    added: '1790370000',
    category_id: '20',
    custom_sid: '',
    tv_archive: 0,
    direct_source: '',
    tv_archive_duration: 0,
  },
  {
    num: 3,
    name: 'WebTV Test Movies',
    stream_type: 'live',
    stream_id: 1003,
    stream_icon: '',
    epg_channel_id: 'webtv.test.movies',
    added: '1790370000',
    category_id: '30',
    custom_sid: '',
    tv_archive: 0,
    direct_source: '',
    tv_archive_duration: 0,
  },
  {
    num: 4,
    name: 'MEGA',
    stream_type: 'live',
    stream_id: 1101,
    stream_icon: '',
    epg_channel_id: 'mega.gr',
    added: '1790370000',
    category_id: '40',
    custom_sid: '',
    tv_archive: 0,
    direct_source: '',
    tv_archive_duration: 0,
  },
];

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
        username: TEST_USERNAME,
        channels: streams.length,
      });
    }

    if (path === '/player_api.php') {
      if (!validCredentials(url)) {
        return json({ user_info: userInfo(0), server_info: serverInfo(url) });
      }

      const action = url.searchParams.get('action') || '';
      if (!action) return json({ user_info: userInfo(1), server_info: serverInfo(url) });
      if (action === 'get_live_categories') return json(categories);
      if (action === 'get_live_streams') return json(streams);
      if (action === 'get_short_epg') return json({ epg_listings: [] });
      return json([]);
    }

    const live = path.match(/^\/live\/([^/]+)\/([^/]+)\/([^/.]+)\.(?:m3u8|ts)$/);
    if (live) {
      const [, username, password, streamId] = live;
      if (decodeURIComponent(username) !== TEST_USERNAME || decodeURIComponent(password) !== TEST_PASSWORD) {
        return json({ error: 'Invalid test credentials' }, 401);
      }
      if (!streams.some(s => String(s.stream_id) === decodeURIComponent(streamId))) {
        return json({ error: 'Unknown test stream' }, 404);
      }
      return Response.redirect(SAMPLE_HLS, 302);
    }

    return json({ error: 'Not found' }, 404);
  },
};
