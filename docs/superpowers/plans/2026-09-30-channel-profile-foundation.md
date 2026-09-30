# Channel Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently deployable Channel Profile foundation: one validated metadata record for every current My Playlist channel, keyed by the stable WebV2 channel id, without changing current UI, EPG, playback or Saved Playlist behavior yet.

**Architecture:** Add a focused companion registry `src/core/channel-profile-gr.js` keyed by ids already owned by `src/core/channel-identity-gr.js`. It owns country/language, canonical Greek category, explicit logo state/provenance metadata and explicit EPG state/mapping metadata. Phase A is data/schema only; later plans separately move logo/category rendering ownership, EPG resolution ownership and import/promotion behavior.

**Tech Stack:** Browser ES modules, Node.js regression tests with `node:assert/strict`, GitHub Actions validation, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-30-channel-profile-metadata-design.md`

## Global Constraints

- Stable WebV2 channel id remains owned by `src/core/channel-identity-gr.js`.
- Channel Profiles must never contain stream URLs or playback routes. `logo.sourceUrl` is allowed only as provenance for the logo asset/reference and must not be interpreted as media playback data.
- Approved visible categories are exactly: `Γενικά`, `Ειδήσεις`, `Αθλητικά`, `Μουσική`, `Περιφερειακά`.
- Current Greek profiles use `country: 'GR'` and `language: 'el'`.
- `logo.status` and `epg.status` must be explicit: `available`, `pending`, or `unavailable`.
- Phase A must not change current My Playlist rendering, EPG matching, Source Hunt/Discovery/Verifier, Player, Saved Playlist reconciliation, or PIN/auth behavior.
- Existing non-empty My Playlist logo URLs may be represented initially as `trusted-fallback` only when they pass the existing logo safety rules; unsafe/redirect-style legacy values such as `goo.gl` stay `pending` until Phase B.
- EPG ownership does not move in Phase A. Profile EPG metadata may remain `pending` until Phase C verifies mappings against the real XMLTV feed.
- Each task follows RED -> minimal GREEN -> relevant regressions -> commit.

## Review Focus

- **Identity/profile id drift:** every active profile id must resolve to the same strict identity id; no second canonical identity namespace. Task 1.
- **Baraza id compatibility:** current D1 ids differ from strict identity ids; profile lookup must resolve through identity rather than duplicate D1 ids. Task 2.
- **Silent metadata gaps:** missing logo or EPG data must be explicit `pending`, not absent/empty objects. Task 1.
- **Category sprawl:** source labels such as `Greece`, `ΠΑΝΕΛΛΑΔΙΚΑ`, `ΚΕΝΤΡ. ΜΑΚΕΔΟΝΙΑ`, `Other` must never become canonical categories. Task 1.
- **Accidental runtime takeover:** Phase A must not yet alter runtime logo/EPG/import ownership. Task 3.

---

### Task 1: Create the Channel Profile schema and 24-profile registry

**Files:**
- Create: `src/core/channel-profile-gr.js`
- Create: `tests/channel-profile-core.test.mjs`
- Read-only dependency: `src/core/channel-identity-gr.js`

**Interfaces:**
- Consumes: `resolveGreekIdentity(value)` and active strict identity records.
- Produces:
  - `CHANNEL_PROFILE_SCHEMA_VERSION` = `1`
  - `CHANNEL_PROFILE_CATEGORIES`
  - `validateChannelProfileDefinition(profile, options?)`
  - `getChannelProfileById(id)`
  - `resolveChannelProfile(value)`
  - `listChannelProfiles()`

- [ ] **Step 1: Write the failing schema/coverage test**

Create `tests/channel-profile-core.test.mjs` and assert:

```js
assert.equal(profile.CHANNEL_PROFILE_SCHEMA_VERSION, 1);
assert.deepEqual([...profile.CHANNEL_PROFILE_CATEGORIES], ['Γενικά','Ειδήσεις','Αθλητικά','Μουσική','Περιφερειακά']);
assert.equal(profile.listChannelProfiles().length, 24);
```

For every profile assert:
- its `id` resolves to the same active strict identity id;
- `country === 'GR'`, `language === 'el'`;
- `category.primary` is one of the five allowed categories;
- `logo.status` and `epg.status` are explicit valid states;
- available logos require HTTPS `preferredUrl` and non-empty `sourceKind`;
- pending logos require empty `preferredUrl`;
- available EPG requires `sourceId` and `preferredId`;
- pending EPG contains explicit empty `aliases: []`;
- no profile or nested EPG object contains `sources`, `directUrls`, `playbackUrl`, or stream-like `.m3u8` values. `logo.sourceUrl` is permitted as non-stream provenance.

Pin categories:
- `Γενικά`: ert1, ert2, ert3, ant1, alpha, skai, mega, open, star
- `Ειδήσεις`: ertnews, meganews, action24, kontra
- `Περιφερειακά`: tv100
- `Μουσική`: baraza-greek-hits, baraza-laika, madtv, madworld, paniktv, realmusictv
- `Αθλητικά`: ertsports1, ertsports2, ertsports3, ertsports4

Also assert invalid future profiles fail for unknown category, missing country/language, missing logo status and available logo without HTTPS provenance.

- [ ] **Step 2: Run test to verify RED**

Run: `node tests/channel-profile-core.test.mjs`

Expected: FAIL because `src/core/channel-profile-gr.js` does not exist.

- [ ] **Step 3: Implement the minimal registry and validator**

Create `src/core/channel-profile-gr.js`, importing only shared identity helpers.

Requirements:
- registry keys are strict identity ids, never D1/raw playlist ids;
- exactly the 24 current promoted channels have active profiles;
- returned profiles are frozen/read-only;
- current logo URL may be preserved as `trusted-fallback` only if it passes the same acceptance rules as `safeLogo`; rejected legacy values become `pending`;
- Panik TV, Real Music TV and ERT Sports 1-4 start `logo.status='pending'` unless a separately verified logo source is introduced later;
- Phase A EPG stays conservative: use `pending` unless a mapping is explicitly backed by a fixture in this task;
- identity fields such as aliases, official refs and reject rules are composed from the identity registry at read time rather than copied into a second source of truth.

- [ ] **Step 4: Verify GREEN**

Run:
```bash
node tests/channel-profile-core.test.mjs
node tests/channel-identity-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/channel-profile-gr.js tests/channel-profile-core.test.mjs
git commit -m "feat: add channel profile foundation"
```

---

### Task 2: Prove lookup compatibility with current D1/My Playlist identifiers

**Files:**
- Modify: `tests/channel-profile-core.test.mjs`
- Modify only if required: `src/core/channel-profile-gr.js`, `src/core/channel-identity-gr.js`, `tests/channel-identity-core.test.mjs`

**Interfaces:**
- Consumes: `resolveChannelProfile(value)`.
- Produces: current D1-facing ids/names resolve to strict profiles through shared identity matching.

- [ ] **Step 1: Add compatibility fixtures**

Cover all 24 current D1 channel ids/names, explicitly including:

```js
['ert1','ERT1'],
['meganews','MEGA News'],
['barazatvhdgreekhits','BARAZA TV HD Greek Hits'],
['barazatvlaika','Baraza TV Laika'],
['panik-tv','Panik TV'],
['Real Music TV','Real Music TV'],
['ertsports4','ΕΡΤ SPORTS 4']
```

Assert the two Baraza D1 ids resolve to strict ids `baraza-greek-hits` and `baraza-laika`, never duplicate profiles.

- [ ] **Step 2: Run compatibility test**

Run: `node tests/channel-profile-core.test.mjs`

Expected: FAIL only where current D1 identifier recognition is genuinely missing. If already GREEN, make no production change for this step.

- [ ] **Step 3: Add the minimum lookup bridge if required**

`resolveChannelProfile(value)` delegates to `resolveGreekIdentity(value)` and fetches by returned strict id. If a current D1 id itself is missing from shared identity recognition, add only that alias to the existing strict identity record and its identity regression test.

- [ ] **Step 4: Verify**

Run:
```bash
node tests/channel-profile-core.test.mjs
node tests/channel-identity-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit only if this task adds changes**

```bash
git add src/core/channel-profile-gr.js src/core/channel-identity-gr.js tests/channel-profile-core.test.mjs tests/channel-identity-core.test.mjs
git commit -m "test: cover channel profile lookup compatibility"
```

---

### Task 3: Enforce the foundation contract in CI without taking runtime ownership

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `tests/frontend-integration.test.mjs`

**Interfaces:**
- Consumes: `tests/channel-profile-core.test.mjs`.
- Produces: mandatory CI gate and architecture guard for Phase A boundaries.

- [ ] **Step 1: Write failing integration assertions**

Extend `tests/frontend-integration.test.mjs` to assert:
- frontend validation runs `node tests/channel-profile-core.test.mjs`;
- `src/main.js` does not import `channel-profile-gr.js` yet;
- `src/core/epg.js` does not import it yet;
- `src/core/channel-catalog.js` still marks imported M3U channels as temporary source metadata;
- `src/logo-utils.js` remains rendering/sanitation logic only.

- [ ] **Step 2: Run integration audit to verify RED**

Run: `node tests/frontend-integration.test.mjs`

Expected: FAIL because CI does not yet run the new contract test.

- [ ] **Step 3: Add CI step**

In `.github/workflows/validate-frontend.yml`, immediately after shared channel identity:

```yaml
- name: Run channel profile regression test
  run: node tests/channel-profile-core.test.mjs
```

Do not modify Worker deploy workflows in Phase A because no Worker consumes the profile registry yet.

- [ ] **Step 4: Run relevant validation**

Run:
```bash
node tests/channel-profile-core.test.mjs
node tests/channel-identity-core.test.mjs
node tests/frontend-integration.test.mjs
node tests/startup-nonblocking.test.mjs
node tests/discovery-browser-smoke.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/validate-frontend.yml tests/frontend-integration.test.mjs
git commit -m "ci: enforce channel profile contract"
```

---

### Task 4: PR validation, deploy proof and canonical handoff

**Files:**
- No product-code changes unless CI exposes a real defect.
- Update `WEBV2_CURRENT.md` only after merge/deploy/live verification.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified Phase A foundation and handoff to separate Phase B plan.

- [ ] **Step 1: Open draft PR and require full green validation**

Evidence must include channel profile test, identity test, browser smoke, startup regression and frontend integration audit.

- [ ] **Step 2: Review diff for forbidden scope creep**

Confirm no changes to `src/core/epg.js`, `src/logo-utils.js`, `src/core/channel-catalog.js`, `src/main.js`, Source Hunt/Discovery/Verifier Workers, Registry D1 schema, Saved Playlist reconciliation, Player or PIN/auth code.

- [ ] **Step 3: Merge only when PR validation is green**

Do not call DONE after merge alone.

- [ ] **Step 4: Verify post-merge deployment on exact SHA**

Require:
- main Validate WebTV Frontend SUCCESS;
- GitHub Pages SUCCESS;
- live My Playlist still contains 24 channels;
- live WebTV still loads 24/24 channels with normal startup;
- deployed `src/core/channel-profile-gr.js` is readable from Pages and exposes schema version 1 plus all 24 profiles.

Registry component SHA may remain its prior verified value if no Registry code deploy occurs. Do not treat `/api/project-status` as global deployment truth.

Prefer free/read-only verification. Do not use metered browser automation unless browser-only proof is necessary and the user explicitly approves it first.

- [ ] **Step 5: Update canonical state**

Record Phase A as `IMPLEMENTED + DEPLOYED + VERIFIED`, exact merge SHA/workflow runs, and next step = separate Phase B plan for logo + visible category ownership.

---

## Follow-up Plans Required by the Approved Design

After Phase A is verified, create/review separate plans:

1. **Phase B: Logo + visible category ownership**
   - My Playlist consumes canonical profile logo/category.
   - Preserve current valid logos unless deliberately upgraded with documented provenance.
   - Imported/Saved Playlist logo/category remain temporary.

2. **Phase C: EPG ownership migration**
   - Capture current Greek EPG parity fixtures first.
   - Move matching from `src/core/epg.js` / legacy `CHANNEL_ALIASES` to profile + shared identity metadata.
   - Resolve: exact preferred id -> exact alias -> official name -> constrained shared matcher -> no match.
   - Ambiguous/wrong EPG fails closed.

3. **Phase D: Import/promotion contract**
   - Saved Playlists remain lightweight temporary metadata.
   - Promotion to My Playlist resolves/creates a Channel Profile.
   - Foreign profiles carry country/language and may remain `epg.pending`.

4. **Phase E: Multi-country EPG Source Registry**
   - Design only when a real second-country EPG source is needed.
   - Do not build a provider marketplace/framework in advance.
