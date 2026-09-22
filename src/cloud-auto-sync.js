const BUILD_ID='20260922-0724';

// Full-library DOM-triggered Push is intentionally disabled.
// WebTV now relies on the granular D1 writes already performed by the
// Playlist Manager for add/edit/remove channel, save/rename/delete playlist
// and verified source updates. Public cloud reads remain handled by
// cloud-read-sync.js.

console.info(`[WebTV] Granular cloud writes active · full DOM auto-push disabled · build ${BUILD_ID}`);
