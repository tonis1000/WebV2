# WebTV V2 · Master Operations Manual

> **Canonical technical guide for the WebTV project**  
> Last major update: **2026-09-22**  
> Repository: `tonis1000/WebV2`

This file is the **first document to read before making a structural change to WebTV**. It explains what exists, where it lives, how the pieces talk to each other, how deployments work, what is protected, and the procedure we follow when changing the system.

The goal is simple: **GitHub is the source of truth; Cloudflare is the runtime.**

---

## 1. Golden rules

1. **Do not treat the Cloudflare Dashboard editor as the primary source of code.**
   - Worker source belongs in `workers/*.js` in this repository.
   - Normal changes are made in GitHub and deployed automatically by GitHub Actions.

2. **Never commit secrets.**
   - API tokens, PINs and API keys stay in GitHub Secrets or Cloudflare Worker secrets.
   - The public repository may contain binding names and resource IDs, but not secret values.

3. **Every production Worker change must have a live verification step.**
   - A successful upload is not enough.
   - The workflow must prove the expected live endpoint works after Cloudflare propagation.

4. **Keep writes protected.**
   - Public read access is intentional where needed.
   - D1 writes for My Playlist / Saved Playlists must remain authenticated.

5. **Prefer granular writes over full-state replacement.**
   - Add/edit/delete operations write only the affected object/channel where possible.
   - We intentionally disabled DOM-triggered full-library pushes.

6. **If a hotfix is ever made directly in Cloudflare Dashboard, immediately copy it back into this repo.**
   - Otherwise the next GitHub deploy will overwrite the Dashboard-only change.

7. **When architecture, bindings, endpoints, secrets, storage, or deployment rules change, update this file in the same work.**

---

## 2. System map

```text
Browser / WebTV UI
        |
        |  GitHub Pages frontend
        v
+---------------------------+
| WebTV V2 frontend         |
| index.html / src / CSS    |
+---------------------------+
      |        |        |
      |        |        +------------------------------+
      |        |                                       |
      v        v                                       v
Registry    EPG Proxy                           Source Hunt
Worker      Worker                              Worker
      |        |                                       |
      v        v                                       v
     D1    ext.greektv.app                 GitHub / Brave / web

      +-----------------------------------------------+
                              |
                              v
                         TV Cache Worker
                              |
                              v
                           KV TV_CACHE
```

The frontend itself is static. Persistent/server-side behavior lives in Cloudflare Workers, D1 and KV.

---

## 3. Canonical repository layout

### Frontend

- `index.html` — main WebTV page and module loading
- `styles.css` — desktop/base styling
- `mobile.css` — responsive/mobile overrides
- `playlist-manager.css` — Playlist Manager UI
- `src/main.js` — main application wiring
- `src/core/` — player/catalog/EPG/health/source-registry core modules
- `src/sidebar-now.js` — sidebar current-program display and timeline
- `src/playlist-manager.js` — local playlist library + granular Registry writes
- `src/cloud-read-sync.js` — public cloud reads / reconciliation
- `src/cloud-auto-sync.js` — intentionally does **not** full-push on DOM changes anymore
- `src/pin-auth.js` — trusted-device session handling
- `src/saved-sources-ui.js` — verified source saving
- `src/source-hunt-engine.js` / `src/source-hunt-web.js` — source discovery UI/logic

### Cloudflare Workers

These files are now the canonical Worker sources:

- `workers/webtv-registry.js`
- `workers/epg-proxy-gr.js`
- `workers/source-huntatonisworkersdev.js`
- `workers/tv-cache.js`

### Cloudflare setting snapshots

`workers/live-settings/*.json` contains **non-secret** snapshots of the bindings/settings that existed when the live Workers were imported into GitHub.

They are useful when checking whether a future change accidentally alters compatibility dates or bindings.

### Deployment workflows

- `.github/workflows/deploy-webtv-registry.yml`
- `.github/workflows/deploy-epg-proxy-gr.yml`
- `.github/workflows/deploy-source-hunt.yml`
- `.github/workflows/deploy-tv-cache.yml`

---

## 4. Cloudflare inventory

Cloudflare account used by WebTV:

```text
Account ID: c2275f5f50ccabe425a5cafe68128a9a
```

### 4.1 WebTV Registry

```text
Worker name: webtv-registry
Live URL: https://webtv-registry.atonis.workers.dev
Source: workers/webtv-registry.js
Workflow: .github/workflows/deploy-webtv-registry.yml
Compatibility date: 2026-09-22
Current application version: 1.4
Trusted session lifetime: 180 days
```

Bindings/secrets:

```text
D1 binding: DB
D1 database: webtv-registry
D1 database ID: 51ab2eab-59a6-4013-9e38-1d154330456a
Cloudflare secret: ADMIN_TOKEN
Cloudflare secret: ADMIN_PIN
```

Purpose:

- My Playlist persistence
- Saved Playlists persistence
- browser trusted-device authentication
- public M3U export
- protected playlist/channel mutations

### 4.2 EPG Proxy

```text
Worker name: epg-proxy-gr
Live URL: https://epg-proxy-gr.atonis.workers.dev
Source: workers/epg-proxy-gr.js
Workflow: .github/workflows/deploy-epg-proxy-gr.yml
Compatibility date: 2025-12-25
```

Purpose:

- Fetches XMLTV from `https://ext.greektv.app/epg/epg.xml`
- Exposes `/epg` and `/epg.xml`
- Adds CORS for the browser frontend
- Uses Cloudflare caching
- Verifies the upstream looks like XMLTV before serving it

Important behavior:

```text
X-EPG-Proxy-Version: simple-v3
Cloudflare cache TTL: 600 seconds
Browser max-age: 300 seconds
```

### 4.3 Source Hunt

```text
Worker name: source-huntatonisworkersdev
Live URL: https://source-huntatonisworkersdev.atonis.workers.dev
Source: workers/source-huntatonisworkersdev.js
Workflow: .github/workflows/deploy-source-hunt.yml
Compatibility date: 2026-09-20
Current version: 1.13
Cloudflare secret: BRAVE_API_KEY
```

Purpose:

- fresh source discovery for the selected channel
- GitHub searching
- known M3U seed searching
- web search
- forums / Reddit-oriented discovery
- candidate collection for playback testing

The value of `BRAVE_API_KEY` must never be stored in GitHub source.

### 4.4 TV Cache

```text
Worker name: tv-cache
Live URL: https://tv-cache.atonis.workers.dev
Source: workers/tv-cache.js
Workflow: .github/workflows/deploy-tv-cache.yml
Compatibility date: 2026-03-07
```

KV binding:

```text
Binding: TV_CACHE
Namespace ID: 555321f94d8f4ed7b86a77f231da0a30
```

Purpose:

- stores `channel-streams.json`
- stores `proxy-map.json`
- supports controlled proxying only for targets allowed by the proxy map

Important endpoints:

```text
GET/POST /channel-streams.json
GET/POST /proxy-map.json
GET      /proxy?url=...
```

---

## 5. GitHub ↔ Cloudflare deployment model

The repository contains one GitHub Actions secret:

```text
CLOUDFLARE_API_TOKEN
```

The token is scoped to the WebTV Cloudflare account and was created with permissions needed for Workers, KV and D1 management. **Its value must never be printed, committed or pasted into project files.**

### Automatic deployment

When a canonical Worker source changes on `main`, only its corresponding workflow runs.

Examples:

```text
workers/webtv-registry.js
  -> Deploy WebTV Registry Worker

workers/epg-proxy-gr.js
  -> Deploy EPG Proxy Worker

workers/source-huntatonisworkersdev.js
  -> Deploy Source Hunt Worker

workers/tv-cache.js
  -> Deploy TV Cache Worker
```

Each workflow follows the same principle:

1. Checkout repository.
2. Validate JavaScript syntax where applicable.
3. Build a temporary Wrangler configuration inside the GitHub runner.
4. Preserve required bindings/secrets/variables.
5. Deploy with Wrangler.
6. Call the live Worker URL.
7. Fail the workflow if the expected live behavior is not observed.

### Manual deployment

If needed:

```text
GitHub
→ WebV2
→ Actions
→ choose the Worker workflow
→ Run workflow
```

Normally manual deployment should not be necessary because a relevant change on `main` triggers it automatically.

### Cloudflare propagation

A Wrangler deploy can finish before every Cloudflare edge immediately serves the new version.

Therefore verification loops retry for a short period instead of treating the first stale response as a failed deployment.

This behavior was discovered during the first Registry CI deployment: upload succeeded, but the first immediate status request still returned Registry v1.3. The verification was changed to wait for propagation, after which v1.4 / 180-day sessions verified successfully.

---

## 6. Registry API and security model

### Public reads

These are intentionally readable without the PIN/session token:

```text
GET /api/status
GET /api/playlists
GET /api/playlists/:id
GET /api/my-playlist
GET /playlist.m3u
```

This allows a new browser/device to load My Playlist and Saved Playlists without first entering an admin PIN.

### Protected writes

These must stay authenticated:

```text
POST   /api/playlists
DELETE /api/playlists/:id
PUT    /api/my-playlist/channel
DELETE /api/my-playlist/channel/:id
POST   /api/my-playlist/replace
```

Do **not** remove `requireAdmin()` from write routes.

### Login/session flow

```text
6-digit PIN
   ↓
POST /api/login
   ↓
signed session token
   ↓
stored in this browser
   ↓
Authorization: Bearer <session token> on writes
```

Current session lifetime:

```text
180 days
```

The PIN itself is not stored by the browser.

Frontend localStorage keys:

```text
webtv_v2_registry_url
webtv_v2_registry_token
webtv_v2_trusted_device
```

### Trusted-device UX

Normal behavior:

- public reads work immediately
- existing valid browser session is reused silently
- if a write is attempted with no valid session, PIN is requested once
- successful login makes that browser trusted until session expiration/revocation
- there is no permanent visible PIN panel in normal UI

### Important security note

`ADMIN_TOKEN` signs Registry sessions. Rotating it invalidates all existing trusted-browser sessions. Do not rotate it casually.

`ADMIN_PIN` is the 6-digit pairing PIN and is separate from the signing secret.

Registry also rate-limits repeated wrong PIN attempts using D1.

---

## 7. Playlist persistence and sync rules

There are two storage layers:

```text
Browser IndexedDB
Cloudflare D1
```

IndexedDB gives fast local/offline-style behavior. D1 provides shared cloud persistence.

### My Playlist operations

The frontend performs granular D1 writes for:

- Add channel
- Edit channel
- Remove channel
- Add/save a verified source to current channel

### Saved Playlist operations

The frontend performs granular D1 writes for:

- Save playlist
- Rename playlist
- Delete playlist

### No DOM-triggered full push

`src/cloud-auto-sync.js` previously watched DOM mutations and invoked full `Push local → D1`.

That model was intentionally disabled because:

- a cloud read can cause a DOM rerender
- a DOM rerender is not proof that local state should overwrite cloud state
- stale local state could overwrite newer D1 data

The source of truth for writes is now the actual user action / API operation, not DOM movement.

### Cloud reads

`src/cloud-read-sync.js`:

- tries public endpoints first
- reconciles cloud My Playlist and Saved Playlists
- refreshes on startup and periodically
- protects newer local data from blindly being replaced

---

## 8. Sidebar EPG timeline rules

Current agreed behavior:

```text
GREEN = part of current programme already played
RED   = time remaining
NO CURRENT EPG = no timeline at all
```

There is no percentage text.

When a channel has no current EPG item:

- the EPG block is hidden
- its empty second-column space is removed
- channel name/group can reclaim the width

This was specifically adjusted for desktop and narrow mobile layouts.

If the timeline ever looks inverted, first inspect `src/sidebar-now.js`, not old/dead percentage CSS.

---

## 9. Source discovery / Save Source flow

The intended chain is:

```text
Selected channel
   ↓
Source Hunt
   ↓
fresh candidate sources
   ↓
Candidate test
   ↓
real successful playback
   ↓
Save / auto-save verified source
   ↓
local source pool + My Playlist
   ↓
granular D1 channel update (if trusted device session exists)
```

A candidate should not become a trusted saved source merely because a URL was found. Successful playback is the important verification boundary.

The discovery philosophy is to favor fresh evidence:

- recent GitHub activity
- active playlists
- current forums / Reddit discussions
- recent web results

---

## 10. What we do whenever we change WebTV

This is the default change procedure.

### Step 1 — Read this file

Confirm which component owns the behavior:

```text
UI/layout/playback       -> frontend src/CSS
EPG upstream/CORS/cache  -> epg-proxy-gr
playlist persistence     -> webtv-registry + D1
source discovery         -> Source Hunt Worker
shared cached maps/proxy -> tv-cache + KV
```

### Step 2 — Inspect current code before editing

Do not start from memory or an old pasted copy if the repo can be read.

Check:

- current `main`
- affected source file
- related workflow
- relevant bindings/secrets
- callers in the frontend

### Step 3 — Protect existing behavior

Before changing code, identify the behavior that must remain true.

Examples:

- D1 writes remain private
- Source Hunt retains `BRAVE_API_KEY`
- TV Cache retains the `TV_CACHE` KV binding
- Registry retains D1 `DB`
- EPG proxy keeps expected CORS behavior

### Step 4 — Make the smallest coherent change

Prefer one focused change over broad rewrites.

For risky work, use a branch/PR before `main`.

### Step 5 — Static validation

At minimum for Worker JavaScript:

```bash
node --check workers/<worker>.js
```

For frontend changes, inspect module loading/cache-busting and dependent functions.

### Step 6 — Merge/commit to `main`

A Worker source change automatically starts its deploy workflow.

### Step 7 — Watch GitHub Actions

A green `Deploy` step alone is not enough. Confirm the final **Verify live Worker** step also succeeds.

### Step 8 — Verify the actual user outcome

Examples:

- EPG: programme data loads
- Source Hunt: selected-channel hunt returns candidates
- Registry: reads/writes behave correctly
- TV Cache: maps load and proxy works as expected
- Frontend: desktop + mobile layout still behaves correctly

### Step 9 — Update this manual when architecture changed

Update this file if we changed any of:

- Worker name or URL
- binding
- database / KV resource
- secret name
- API endpoint
- authentication rule
- deployment workflow
- source-of-truth rule
- major frontend data flow

---

## 11. Creating a new Cloudflare Worker for WebTV

Do not create a permanent “Dashboard-only” Worker.

Procedure:

1. Create source under:

```text
workers/<worker-name>.js
```

2. Decide its resources:

```text
Does it need D1?
Does it need KV?
Does it need a secret?
Does it call an upstream API?
```

3. Create a dedicated GitHub workflow under:

```text
.github/workflows/deploy-<worker-name>.yml
```

4. Put non-secret binding configuration in the workflow/Wrangler config.

5. Put secret values in Cloudflare Worker Secrets or GitHub Actions Secrets, never source.

6. Add a deterministic live verification endpoint/test.

7. Deploy and verify before wiring the frontend to it.

8. Add the Worker to this manual.

---

## 12. Secrets and where they belong

### GitHub Actions secret

```text
CLOUDFLARE_API_TOKEN
```

Purpose: CI/CD authentication to Cloudflare.

Do not expose it in logs or source.

### Cloudflare Worker secrets

Registry:

```text
ADMIN_TOKEN
ADMIN_PIN
```

Source Hunt:

```text
BRAVE_API_KEY
```

A secret can exist in Cloudflare even though its value is intentionally absent from GitHub.

### Not secrets

These are identifiers/configuration and may exist in the repository:

- Cloudflare account ID
- D1 database ID
- KV namespace ID
- Worker names
- public Worker URLs

---

## 13. Rollback procedure

Git is our rollback mechanism.

If a Worker change breaks production:

1. Identify last known good commit for that Worker.
2. Revert the bad commit or restore the previous Worker file content.
3. Commit to `main`.
4. The same deploy workflow automatically redeploys the old code.
5. Confirm **Verify live Worker** goes green.
6. Test the user-facing behavior.

Avoid “fixing” production only in the Cloudflare editor because that creates drift between GitHub and the live runtime.

---

## 14. Data safety notes

### D1

D1 stores user-curated playlist state. Code deployments should not drop/recreate the database.

The Registry workflow resolves the existing `webtv-registry` D1 and binds it as `DB`.

Do not casually add SQL such as:

```sql
DROP TABLE
DELETE FROM playlists
DELETE FROM my_playlist
```

without explicitly confirming that destructive behavior is intended.

### KV

`tv-cache` uses the existing `TV_CACHE` namespace. A code deployment should keep the same namespace binding so cached maps survive deployments.

---

## 15. Current production verification points

Use these when troubleshooting.

### Registry

```text
https://webtv-registry.atonis.workers.dev/api/status
```

Expected important values:

```text
version = 1.4
sessionDays = 180
```

### EPG Proxy

```text
https://epg-proxy-gr.atonis.workers.dev/
https://epg-proxy-gr.atonis.workers.dev/epg.xml
```

Root should tell the caller to use `/epg` or `/epg.xml`.

### Source Hunt

```text
https://source-huntatonisworkersdev.atonis.workers.dev/
```

Expected service:

```text
WebTV Source Hunt Worker
version 1.13
```

### TV Cache

```text
https://tv-cache.atonis.workers.dev/channel-streams.json
```

Expected: valid JSON and a working `TV_CACHE` KV binding.

---

## 16. What was migrated on 2026-09-22

### Frontend / D1

- Fixed sidebar timeline semantics and no-EPG layout.
- Removed percentage display from the active sidebar timeline implementation.
- Implemented trusted-device Registry access.
- Removed permanent visible PIN panel from normal use.
- Session lifetime changed from 30 to 180 days.
- Made Saved Playlist detail reads public.
- Kept all mutation endpoints authenticated.
- Disabled DOM-triggered full-library D1 pushes.
- Preserved granular automatic writes for channel/source/playlist actions.

### Registry CI/CD

- Added canonical `workers/webtv-registry.js`.
- Added GitHub Actions deployment.
- Added D1 discovery.
- Preserved Registry secrets.
- Added live post-deploy verification with propagation retries.
- First production CI deploy verified Registry v1.4 / 180 days.

### Remaining Cloudflare Workers

The live code for these Workers was safely pulled from Cloudflare, inspected for embedded credentials, syntax-checked, then made canonical in GitHub:

```text
epg-proxy-gr
source-huntatonisworkersdev
tv-cache
```

Bindings were preserved:

```text
Source Hunt -> secret BRAVE_API_KEY
TV Cache    -> KV TV_CACHE
EPG Proxy   -> no binding
```

Dedicated deploy workflows were then created and their first live deployments were verified successfully.

The temporary one-time snapshot workflow used during migration was removed afterward so it does not clutter normal operations.

---

## 17. Fast decision table

| If we want to change... | Start here |
|---|---|
| Player behavior | `src/core/player.js` / `src/main.js` |
| Channel list / sidebar EPG | `src/sidebar-now.js` |
| Responsive UI | `mobile.css` + relevant component CSS |
| EPG source/proxy/cache | `workers/epg-proxy-gr.js` |
| My Playlist / Saved Playlists server behavior | `workers/webtv-registry.js` |
| Browser playlist UI/persistence | `src/playlist-manager.js` |
| Trusted PIN/session behavior | `src/pin-auth.js` + Registry Worker |
| Public cloud library reads | `src/cloud-read-sync.js` + Registry Worker |
| Source Hunt server search | `workers/source-huntatonisworkersdev.js` |
| Source Hunt frontend | `src/source-hunt-engine.js`, `src/source-hunt-web.js` |
| Verified source saving | `src/saved-sources-ui.js` |
| Shared stream/proxy maps | `workers/tv-cache.js` |
| Worker deployment behavior | corresponding `.github/workflows/deploy-*.yml` |

---

## 18. Definition of “done” for a WebTV change

A change is not done merely because code was written.

For WebTV, **done** means:

```text
[ ] Current source was inspected before editing
[ ] Existing required behavior was identified
[ ] Change was implemented in the canonical GitHub source
[ ] No secret was committed
[ ] Syntax/static checks passed
[ ] Correct workflow deployed the affected Worker (if applicable)
[ ] Final live verification step passed
[ ] Actual WebTV behavior was checked
[ ] Mobile/desktop was considered when UI changed
[ ] This manual was updated if architecture/config changed
```

---

## 19. Change log

### 2026-09-22

- Established GitHub as canonical source for all four WebTV Cloudflare Workers.
- Added protected automatic Cloudflare deployment from GitHub Actions.
- Added `CLOUDFLARE_API_TOKEN` repository secret for CI/CD.
- Imported and preserved live Worker bindings/settings.
- Verified production deploy for Registry, EPG Proxy, Source Hunt and TV Cache.
- Registry moved to v1.4 with 180-day trusted browser sessions.
- Public-read/protected-write Registry model established.
- Full DOM-triggered D1 push disabled in favor of granular writes.
- Sidebar EPG timeline/mobile behavior corrected.
- Created this master operations document as the canonical operating guide.

---

## 20. Before the next WebTV session

When returning to this project after days or months, start with this order:

```text
1. Read WEBTV_OPERATIONS.md
2. Read current main branch, not old local/pasted copies
3. Check GitHub Actions health
4. Check the live endpoint for the component we will touch
5. Make the change in GitHub
6. Let CI deploy it
7. Verify live result
8. Update this document when the system map changes
```

That keeps WebTV reproducible and prevents the project from turning into a maze of “which copy is the real one?” files.
