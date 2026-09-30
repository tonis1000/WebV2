# Channel Profile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently deployable Channel Profile foundation: one validated metadata record for every current My Playlist channel, keyed by the stable WebV2 channel id, without changing current UI, EPG, playback or Saved Playlist behavior yet.

**Architecture:** Add a focused companion registry `src/core/channel-profile-gr.js` keyed by the ids already owned by `src/core/channel-identity-gr.js`. The profile registry owns country/language, canonical Greek category, explicit logo state/provenance metadata and explicit EPG state/mapping metadata. This Phase A is data/schema only; later plans separately move logo rendering ownership, EPG resolution ownership and import/promotion behavior.

**Tech Stack:** Browser ES modules, Node.js regression tests with `node:assert/strict`, GitHub Actions validation, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-30-channel-profile-metadata-design.md`

## Global Constraints

- Stable WebV2 channel id remains owned by `src/core/channel-identity-gr.js`.
- Channel Profiles must never contain stream URLs or playback routes.
- Approved visible categories are exactly: `Γενικά`, `Ειδήσεις`, `Αθλητικά`, `Μουσική`, `Περιφερειακά`.
- Current Greek profiles use `country: 'GR'` and `language: 'el'`.
- `logo.status` and `epg.status` must be explicit: `available`, `pending`, or `unavailable`.
- Phase A must not change current My Playlist rendering, EPG matching, Source Hunt/Discovery/Verifier, Player, Saved Playlist reconciliation, or PIN/auth behavior.
- Existing non-empty My Playlist logo URLs may be represented initially as `trusted-fallback` metadata so current assets are preserved without falsely claiming official provenance. Empty logos are `pending`.
- EPG ownership does not move in Phase A. Profile EPG metadata may be `pending` until Phase C verifies mappings against the real XMLTV feed.
- Each task follows RED -> minimal GREEN -> full relevant regression checks -> commit.

## Review Focus

- **Identity/profile id drift:** every active profile id must resolve to the same strict identity id; no second canonical identity namespace is allowed. Covered in Task 1 tests.
- **Baraza id compatibility:** current D1 ids differ from strict identity ids (`barazatvhdgreekhits` / `barazatvlaika` vs `baraza-greek-hits` / `baraza-laika`); the profile lookup must resolve through identity rather than duplicate D1 ids. Covered in Task 2 tests.
- **Silent metadata gaps:** missing logo or EPG data must be explicit `pending`, not empty/missing objects. Covered in Task 1 validator tests.
- **Category sprawl:** source labels such as `Greece`, `ΠΑΝΕΛΛΑΔΙΚΑ`, `ΚΕΝΤΡ. ΜΑΚΕΔΟΝΙΑ`, `Other` must not enter the canonical category set. Covered in Task 1 tests.
- **Accidental runtime takeover:** adding profiles must not yet change `src/main.js`, `src/core/epg.js`, `src/logo-utils.js`, M3U imports or Saved Playlist semantics. Covered in Task 3 architecture regression assertions and the existing full suite.

---

### Task 1: Create the Channel Profile schema and 24-profile registry

**Files:**
- Create: `src/core/channel-profile-gr.js`
- Create: `tests/channel-profile-core.test.mjs`
- Read-only dependency: `src/core/channel-identity-gr.js`

**Interfaces:**
- Consumes: `resolveGreekIdentity(value)` and strict active identity records from `src/core/channel-identity-gr.js`.
- Produces:
  - `CHANNEL_PROFILE_SCHEMA_VERSION: number` initially `1`
  - `CHANNEL_PROFILE_CATEGORIES: readonly string[]`
  - `validateChannelProfileDefinition(profile, options?) -> { ok: boolean, errors?: string[] }`
  - `getChannelProfileById(id) -> profile | null`
  - `resolveChannelProfile(value) -> profile | null`
  - `listChannelProfiles() -> profile[]`

- [ ] **Step 1: Write the failing schema/coverage test**

Create `tests/channel-profile-core.test.mjs` with assertions that:

```js
assert.equal(profile.CHANNEL_PROFILE_SCHEMA_VERSION, 1);
assert.deepEqual([...profile.CHANNEL_PROFILE_CATEGORIES], ['Γενικά','Ειδήσεις','Αθλητικά','Μουσική','Περιφερειακά']);
assert.equal(profile.listChannelProfiles().length, 24);
```

For every profile assert:
- `id` resolves to an active strict identity and equals that identity id.
- `country === 'GR'` and `language === 'el'`.
- `category.primary` is one of the five allowed categories.
- `logo.status` is one of `available|pending|unavailable`.
- `epg.status` is one of `available|pending|unavailable`.
- `logo.status === 'available'` requires HTTPS `preferredUrl` plus non-empty `sourceKind`.
- `logo.status === 'pending'` requires empty `preferredUrl`.
- `epg.status === 'available'` requires non-empty `sourceId` and `preferredId`.
- `epg.status === 'pending'` may have null/empty source fields but must still contain `aliases: []`.
- no profile object contains `sources`, `directUrls`, `sourceUrl`, `playbackUrl`, or stream-like `.m3u8` values.

Pin the 24 canonical categories:
- `Γενικά`: ert1, ert2, ert3, ant1, alpha, skai, mega, open, star
- `Ειδήσεις`: ertnews, meganews, action24, kontra
- `Περιφερειακά`: tv100
- `Μουσική`: baraza-greek-hits, baraza-laika, madtv, madworld, paniktv, realmusictv
- `Αθλητικά`: ertsports1, ertsports2, ertsports3, ertsports4

Also assert malformed future profiles fail validation for unknown category, missing country/language, missing logo status, and available logo without HTTPS provenance.

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/channel-profile-core.test.mjs`

Expected: FAIL because `src/core/channel-profile-gr.js` does not exist.

- [ ] **Step 3: Implement the minimal profile registry and validator**

Create `src/core/channel-profile-gr.js` importing only identity helpers from `./channel-identity-gr.js`.

Implementation requirements:
- registry keys are strict identity ids, not D1/raw playlist ids;
- all 24 active profiles exist;
- all profiles are frozen/read-only exports;
- current non-empty D1 logo values may be copied as `logo.status='available'`, `sourceKind='trusted-fallback'`, with the same URL preserved;
- Panik TV, Real Music TV and ERT Sports 1-4 start with `logo.status='pending'` unless a separately verified canonical source is introduced in the later logo plan;
- Phase A EPG metadata starts explicit and conservative; do not claim `available` unless backed by a fixture or verified mapping in this task. It is acceptable for profiles to start `epg.status='pending'` while current runtime EPG behavior remains unchanged;
- do not duplicate `canonicalName`, aliases, official refs or reject rules into the profile registry unless the helper returns a composed view at read time. Identity remains authoritative.

- [ ] **Step 4: Run profile and identity regressions**

Run:
```bash
node tests/channel-profile-core.test.mjs
node tests/channel-identity-core.test.mjs
```

Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add src/core/channel-profile-gr.js tests/channel-profile-core.test.mjs
git commit -m "feat: add channel profile foundation"
```

---

### Task 2: Prove lookup compatibility with current D1/My Playlist names without changing runtime consumers

**Files:**
- Modify: `tests/channel-profile-core.test.mjs`
- Modify only if needed for lookup behavior: `src/core/channel-profile-gr.js`

**Interfaces:**
- Consumes: `resolveChannelProfile(value)` from Task 1.
- Produces: guaranteed profile resolution from current D1-facing `id`, `tvgId`, or `name` strings through shared identity matching.

- [ ] **Step 1: Add failing compatibility fixtures**

Add a fixture array matching the current 24 My Playlist-facing identifiers/names, including:

```js
['ert1','ERT1'],
['meganews','MEGA News'],
['barazatvhdgreekhits','BARAZA TV HD Greek Hits'],
['barazatvlaika','Baraza TV Laika'],
['panik-tv','Panik TV'],
['Real Music TV','Real Music TV'],
['ertsports4','ΕΡΤ SPORTS 4']
```

For each fixture assert `resolveChannelProfile(rawIdOrName)` returns the expected strict profile id. Specifically assert the two Baraza D1 ids resolve to `baraza-greek-hits` and `baraza-laika` rather than creating duplicate profiles.

- [ ] **Step 2: Run the test and verify RED if lookup compatibility is incomplete**

Run: `node tests/channel-profile-core.test.mjs`

Expected: FAIL only for any current D1 identifier not already resolved through the shared identity core. If it is already fully GREEN, document that the existing identity resolver already satisfies this task and make no production change.

- [ ] **Step 3: Add the minimum lookup bridge if required**

In `src/core/channel-profile-gr.js`, keep raw aliases out of the profile registry itself. Normalize lookup by delegating to `resolveGreekIdentity(value)` and then use the returned strict identity id to fetch the profile.

If a current D1 id is genuinely missing from identity recognition, add that string as an alias to the existing strict identity record in `src/core/channel-identity-gr.js` and extend `tests/channel-identity-core.test.mjs`; do not add a second profile id.

- [ ] **Step 4: Verify compatibility**

Run:
```bash
node tests/channel-profile-core.test.mjs
node tests/channel-identity-core.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit only if Task 2 changed code/tests beyond Task 1**

```bash
git add src/core/channel-profile-gr.js src/core/channel-identity-gr.js tests/channel-profile-core.test.mjs tests/channel-identity-core.test.mjs
git commit -m "test: cover channel profile lookup compatibility"
```

---

### Task 3: Wire the profile contract into CI while preserving all existing runtime ownership

**Files:**
- Modify: `.github/workflows/validate-frontend.yml`
- Modify: `tests/frontend-integration.test.mjs`

**Interfaces:**
- Consumes: `tests/channel-profile-core.test.mjs`.
- Produces: mandatory CI gate for every future profile change and architecture guard that Phase A does not prematurely take over logo/EPG/import runtime behavior.

- [ ] **Step 1: Write failing CI/integration assertions**

Extend `tests/frontend-integration.test.mjs` to assert:
- `validate-frontend.yml` runs `node tests/channel-profile-core.test.mjs`;
- `src/main.js` still obtains cloud channel presentation fields from the current registry mapping during Phase A and does not yet import `channel-profile-gr.js`;
- `src/core/epg.js` remains unchanged as EPG runtime owner during Phase A and the profile foundation is not imported there yet;
- `src/core/channel-catalog.js` still treats imported M3U metadata as temporary source metadata;
- `src/logo-utils.js` remains URL sanitation/rendering only and is not rewritten in Phase A.

- [ ] **Step 2: Run integration audit and verify RED**

Run: `node tests/frontend-integration.test.mjs`

Expected: FAIL because the Channel Profile contract test is not yet a named CI step.

- [ ] **Step 3: Add the Channel Profile test to frontend validation**

Modify `.github/workflows/validate-frontend.yml` with a named step immediately after shared channel identity:

```yaml
- name: Run channel profile regression test
  run: node tests/channel-profile-core.test.mjs
```

No Worker deploy workflow is changed in Phase A because no Worker imports the profile registry yet.

- [ ] **Step 4: Run all local validation relevant to Phase A**

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
- No new product code unless CI reveals a real defect.
- Update canonical `WEBV2_CURRENT.md` only after merge/deploy/live verification.

**Interfaces:**
- Consumes: Tasks 1-3 complete.
- Produces: verified Phase A foundation and a clean handoff for the next separate implementation plan, Phase B logo/category ownership.

- [ ] **Step 1: Open a draft PR and verify the expected full validation set**

Required PR evidence:
- `channel-profile-core` PASS
- `channel-identity-core` PASS
- browser smoke PASS
- non-blocking startup PASS
- frontend integration audit PASS
- no unrelated Worker deploy required solely because the foundation registry is not yet consumed by Workers

- [ ] **Step 2: Review the diff for forbidden scope creep**

Confirm no changes to:
- `src/core/epg.js`
- `src/logo-utils.js`
- `src/core/channel-catalog.js`
- `src/main.js`
- Source Hunt / Source Discovery / Source Verifier Workers
- Registry D1 persistence schema
- Saved Playlist persistence/reconciliation
- Player
- PIN/auth code

- [ ] **Step 3: Merge only with green PR validation**

Expected: merge commit on `main`; do not call DONE yet.

- [ ] **Step 4: Verify post-merge production gates**

Require:
- main `Validate WebTV Frontend` SUCCESS on the exact merge SHA;
- GitHub Pages SUCCESS on the same merge SHA;
- Registry deployed SHA may remain the previous Registry component SHA unless Registry workflow legitimately ran; do not misreport Registry status as global deployment truth;
- live My Playlist still returns 24 channels;
- live WebTV still loads 24/24 channels and startup behavior remains normal;
- deployed `src/core/channel-profile-gr.js` is readable from Pages and exposes schema version 1 plus all 24 profiles.

Use free/read-only checks where possible; do not use metered browser automation unless a browser-only proof is necessary and explicitly approved.

- [ ] **Step 5: Update canonical state**

Record Phase A as `IMPLEMENTED + DEPLOYED + VERIFIED`, list the exact merge SHA/workflow runs, and set the next step to a **separate Phase B plan** for canonical logo ownership plus visible Greek categories.

---

## Follow-up Plans Required by the Approved Design

Do not fold these into Phase A. Write/review them separately after the foundation is verified:

1. **Phase B: Logo + visible category ownership**
   - My Playlist consumes canonical profile logo/category.
   - Preserve current logos unless deliberately upgraded with provenance.
   - Imported/Saved Playlist logo/category stay temporary.
   - Missing logos become explicit placeholders/pending state.

2. **Phase C: EPG ownership migration**
   - First capture current Greek EPG parity fixtures.
   - Then move matching from `src/core/epg.js`/legacy `CHANNEL_ALIASES` to profile + shared identity metadata.
   - Exact preferred id -> alias -> official name -> constrained shared matcher -> no match.
   - Wrong/ambiguous EPG must fail closed.

3. **Phase D: Import/promotion contract**
   - Saved Playlists remain lightweight temporary metadata.
   - Promotion to My Playlist requires/resolves a Channel Profile.
   - Foreign channel profiles carry country/language and can remain `epg.pending` until a future source is configured.

4. **Phase E: Multi-country EPG Source Registry**
   - Design only when a real second-country EPG source is needed.
   - No provider marketplace/framework in advance.
