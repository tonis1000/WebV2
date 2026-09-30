export const CONFIG = Object.freeze({
  appName: 'WebTV V2',
  buildId: '20260924-1115',
  registryUrl: 'https://webtv-registry.atonis.workers.dev',
  cacheBaseUrl: 'https://tv-cache.atonis.workers.dev',
  epgUrl: 'https://epg-proxy-gr.atonis.workers.dev/epg.xml',
  epgFallbackUrl: 'https://ext.greektv.app/epg/epg.xml',
  legacySeedCatalogUrl: './data/channels.m3u?v=20260920-1021',
  healthStorageKey: 'webtv_v2_health',
  requestTimeoutMs: 9000,
  startupTimeoutMs: 12000,
  epgRefreshMs: 30 * 60 * 1000,
  healthMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  failureCooldownThreshold: 2,
  failureCooldownBaseMs: 15 * 60 * 1000,
  failureCooldownMaxMs: 6 * 60 * 60 * 1000,
  workerForHls: true,
  maxNextPrograms: 3,
});

export const OFFICIAL_LIVE = Object.freeze({
  ert1: 'https://live.ertflix.gr/',
  ert2: 'https://live.ertflix.gr/',
  ert3: 'https://live.ertflix.gr/',
  ertnews: 'https://live.ertflix.gr/',
  ant1: 'https://www.antenna.gr/live',
  madtv: 'https://www.youtube.com/@madtvgreece/live',
});

export const OFFICIAL_FALLBACKS = Object.freeze({
  madtv: Object.freeze({
    label: 'Official YouTube',
    route: 'official-youtube',
    player: 'youtube-embed',
    externalUrl: 'https://www.youtube.com/@madtvgreece/live',
    embedUrl: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCs3cho4vcDuCze0tk3W9iVQ&autoplay=1&playsinline=1&rel=0',
  }),
});

export const SOURCE_BLOCKLIST = Object.freeze([
  'https://spark3.smart-tv-data.com/ert1HD/ert1HD/playlist.m3u8',
  'https://cdn4.smart-tv-data.com/vid/ert1/playlist.m3u8',
  'http://195.226.218.163/vid/ert1/playlist.m3u8',
  'https://ert-live.siliconweb.com/media/ert_1/ert_1.m3u8',
  'https://ertflix.s.llnwi.net/ertlive/ert1/clrdef24723b/playlist.m3u8',
  'https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.m3u8',
  'https://spark3.smart-tv-data.com/vid/ert2hd/playlist.m3u8',
  'https://wow.anixa.tv/live/ert2/playlist.m3u8',
  'https://ert-live.siliconweb.com/media/ert_2/ert_2.m3u8',
  'https://ertflix.s.llnwi.net/ertlive/ert2/clrdef24828z/playlist.m3u8',
  'https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT2/default/index.m3u8',
  'https://spark3.smart-tv-data.com/vid/ert3hd/playlist.m3u8',
  'https://ertflix.akamaized.net/ertlive/ert3/clrdef24828n/playlist.m3u8',
  'https://ertflix.s.llnwi.net/ertlive/ertnews/default/index.m3u8',
  'https://ertflix.akamaized.net/ertlive/ertnews/default/playlist.m3u8',
  'https://ert-live.siliconweb.com/media/ert_news/ert_news.m3u8',
  'https://lcdn.antennaplus.gr/r86d08d448885424196f6cd3ddc5d1489/eu-central-1/6415884360001/playlist_dvr.m3u8',
  'https://spark3.smart-tv-data.com/ant1HD/ant1HD/playlist.m3u8',
  'https://mcdn.antennaplus.gr/live/media0/Ant1/HLS/Ant1.m3u8',
  'https://cdn1.smart-tv-data.com/live/ant1/playlist.m3u8',
  'http://185.102.171.218/MegaHD/index.m3u8',
  'http://wow.anixa.tv/live/mega/playlist.m3u8',
]);
