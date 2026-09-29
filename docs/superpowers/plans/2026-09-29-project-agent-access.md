# WebV2 Project Agent Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a revocable, persistent, project-state-only agent session so the project agent can read and update `WEBV2_CURRENT.md` across conversations without receiving the human PIN or `ADMIN_TOKEN`.

**Architecture:** Keep the existing human/admin authentication unchanged. Add one-time pairing records and revocable project-agent sessions in Registry D1, issue a Secure/HttpOnly/SameSite=Strict cookie scoped to `/api/project-agent`, and expose only project-state operations through that namespace. Use a distinct token version and `scope: project-state`, signed with a domain-separated key derived from the existing Registry `ADMIN_TOKEN`, so project-agent tokens can never satisfy `requireAdmin()`.

**Tech Stack:** Cloudflare Worker JavaScript, D1, Web Crypto/HMAC-SHA256, browser Fetch/CORS, existing GitHub Actions CI/CD, Node regression tests.

**Spec:** `docs/superpowers/specs/2026-09-29-project-agent-access-design.md`

## Global Constraints

- Base verified production Registry SHA before this work: `5f9b61cb79cdfd4a89b0251b948d9e92affb37a0`.
- Human PIN/admin behavior must remain unchanged.
- Project-agent authorization is limited to project-state routes only.
- Project-agent sessions must never satisfy `requireAdmin()`.
- Session lifetime: 180 days, matching the current trusted-device horizon, but revocable through D1.
- Pairing lifetime: 5 minutes and single-use.
- Session cookie: `Secure; HttpOnly; SameSite=Strict; Path=/api/project-agent`.
- No PIN, `ADMIN_TOKEN`, completion secret, session token, or private checkpoint Markdown may appear in CI logs.
- Existing checkpoint SHA/CAS/history behavior remains the persistence boundary.
- No Player, Source Hunt, Discovery, TV Cache, Verifier, Xtream, or EPG behavior changes in this work.
- DONE means implemented + deployed + actually verified.
- After every meaningful verified milestone, preserve a recoverable handoff with SHA, status, verification evidence, blocker/next step.

## Review Focus

- Pairing replay after successful completion must return failure and must not issue another session.
- A valid project-agent token presented to an existing admin mutation must still return `401`.
- An expired or revoked D1 session must fail even if its HMAC signature is valid.
- A stale `expectedSha256` on `WEBV2_CURRENT.md` must remain `409` through the project-agent namespace.
- Cross-origin human approval from the WebV2 admin UI must work without exposing the agent cookie or relaxing cookie scope.

---

### Task 1: Pairing and revocable session primitives

**Files:**
- Modify: `workers/webtv-registry.js`
- Create: `tests/project-agent-auth.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Consumes: existing `hmac(secret, message)`, `b64url(...)`, `fromB64url(...)`, `safeEqual(...)`, `requireAdmin(...)`, D1 binding `env.DB`.
- Produces:
  - `createProjectAgentPairing(env) -> { pairingId, completionSecret, expiresAt }`
  - `approveProjectAgentPairing(env, pairingId) -> { ok, pairingId, approvedAt }`
  - `completeProjectAgentPairing(env, pairingId, completionSecret) -> { token, sessionId, expiresAt }`
  - `verifyProjectAgentSession(token, env) -> { ok, sessionId? }`
  - `revokeProjectAgentSession(env, sessionId) -> { ok }`

- [ ] **Step 1: Write failing tests for pairing creation and storage**

Add assertions that a pairing gets a random public id, a raw completion secret is returned once, D1 stores only its SHA-256 hash, expiry is 5 minutes, and the row starts unapproved/unused.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node tests/project-agent-auth.test.mjs`
Expected: FAIL because pairing/session primitives do not exist.

- [ ] **Step 3: Implement D1 tables and pairing creation**

Add focused helpers in `workers/webtv-registry.js` for:
- `project_agent_pairings(pairing_id, secret_sha256, created_at, expires_at, approved_at, used_at)`
- `project_agent_sessions(session_id, issued_at, expires_at, revoked_at)`

Use Web Crypto randomness for the completion secret and SHA-256 for stored secret comparison material.

- [ ] **Step 4: Add tests for approval, wrong secret, expiry, and single-use completion**

Assertions:
- approval changes only the named pending pairing;
- unapproved completion fails;
- wrong secret fails;
- expired pairing fails;
- used pairing fails;
- successful completion marks `used_at` and creates one session.

- [ ] **Step 5: Implement project-agent token/session issuance and verification**

Token payload fields must be exactly: `v:2`, `scope:'project-state'`, `sid`, `iat`, `exp`.
Sign with a domain-separated HMAC key derived from existing `ADMIN_TOKEN` for project-agent use. `verifyProjectAgentSession()` must require the payload version/scope and then require a matching non-revoked, non-expired D1 session row.

- [ ] **Step 6: Add the privilege-separation regression**

Call existing `/api/session` or representative `requireAdmin()` path with a valid project-agent token and assert `401`.

- [ ] **Step 7: Run tests and full syntax validation**

Run:
- `node tests/project-agent-auth.test.mjs`
- `node --input-type=module --check < workers/webtv-registry.js`

Expected: PASS.

- [ ] **Step 8: Wire the test into frontend validation and commit**

Add `node tests/project-agent-auth.test.mjs` to `.github/workflows/validate-frontend.yml` near the Registry checkpoint tests.

Commit message: `Add scoped project agent session primitives`

- [ ] **Step 9: Record recoverable handoff**

Record branch SHA, Task 1 GREEN evidence, and exact next task in the working handoff state before continuing.

---

### Task 2: Dedicated `/api/project-agent` route namespace

**Files:**
- Modify: `workers/webtv-registry.js`
- Modify: `tests/project-agent-auth.test.mjs`
- Reuse: `tests/project-checkpoint-write-api.test.mjs`

**Interfaces:**
- Consumes: Task 1 pairing/session helpers; existing project checkpoint helpers and project deploy status query.
- Produces HTTP routes:
  - `POST /api/project-agent/pair/start`
  - `POST /api/project-agent/pair/approve`
  - `POST /api/project-agent/pair/complete`
  - `GET /api/project-agent/session`
  - `DELETE /api/project-agent/session`
  - `GET /api/project-agent/status`
  - `GET /api/project-agent/checkpoints`
  - `GET /api/project-agent/checkpoints/{name}`
  - `PUT /api/project-agent/checkpoints/{name}`
  - `GET /api/project-agent/checkpoints/{name}/history`

- [ ] **Step 1: Write failing route-level tests**

Assert anonymous project-agent status/checkpoint/session operations return `401`, except `pair/start` and `pair/complete`; `pair/approve` requires normal admin bearer authentication.

- [ ] **Step 2: Run route tests and verify RED**

Run: `node tests/project-agent-auth.test.mjs`
Expected: FAIL because namespace routes do not exist.

- [ ] **Step 3: Implement pairing routes**

Route behavior:
- `pair/start`: create challenge, return only `pairingId`, `completionSecret`, `expiresAt`.
- `pair/approve`: require `requireAdmin()`, accept `{pairingId}`.
- `pair/complete`: accept `{pairingId, completionSecret}`, set project-agent cookie on success, do not return the human/admin token.

- [ ] **Step 4: Implement cookie parsing and scoped session guard**

Add a dedicated `requireProjectAgent(request, env)` that reads only the project-agent cookie and calls `verifyProjectAgentSession()`. Do not add project-agent acceptance to `requireAdmin()`.

- [ ] **Step 5: Implement project-state proxy routes**

Reuse the existing checkpoint/status helpers. Do not expose arbitrary Registry paths. Checkpoint PUT must continue to require `expectedSha256` for existing checkpoints and preserve existing 409/428 semantics.

- [ ] **Step 6: Implement logout/revocation**

`DELETE /api/project-agent/session` revokes the D1 session row and expires the cookie with the same Path/SameSite/Secure/HttpOnly attributes.

- [ ] **Step 7: Add authorization-matrix tests**

With a valid project-agent session, assert:
- checkpoint list/read/history works;
- `WEBV2_CURRENT.md` update with current SHA works;
- stale SHA remains `409`;
- My Playlist write is `401`;
- Favorites write is `401`;
- Health write is `401`;
- Saved Playlist write is `401`;
- revoked session is `401`.

- [ ] **Step 8: Run Registry tests and commit**

Run:
- `node tests/project-agent-auth.test.mjs`
- `node tests/project-checkpoint-write-api.test.mjs`

Expected: PASS.

Commit message: `Expose scoped project agent state routes`

- [ ] **Step 9: Record recoverable handoff**

Record Task 2 SHA and authorization-matrix evidence before UI work.

---

### Task 3: Minimal human pairing approval surface

**Files:**
- Create: `src/project-agent-pairing-admin.js`
- Modify: `index.html` only to load the module after `pin-auth.js` / `admin-gate.js`
- Create: `tests/project-agent-pairing-admin.test.mjs`
- Modify: `.github/workflows/validate-frontend.yml`

**Interfaces:**
- Consumes: `window.WebTVRegistryAuth.ensureSession()`, `.token()`, `.base()` from `src/pin-auth.js`; `webtv:admin-visibility` event from `src/admin-gate.js`; Registry `POST /api/project-agent/pair/approve`.
- Produces: `window.WebTVProjectAgentPairingAdmin` with `approve(pairingId)` and a minimal admin-only UI for entering/confirming a pairing id.

- [ ] **Step 1: Write failing DOM/module tests**

Assert the module:
- remains hidden while admin UI is locked;
- asks existing auth layer to ensure a human admin session;
- sends only `{pairingId}` plus the existing admin bearer token to `/api/project-agent/pair/approve`;
- never reads or stores the PIN;
- does not expose the bearer token in rendered text or logs.

- [ ] **Step 2: Run test and verify RED**

Run: `node tests/project-agent-pairing-admin.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal approval module**

Inject a small admin-only pairing approval control from JavaScript so no unrelated HTML structure is refactored. React to `webtv:admin-visibility` and use the existing trusted-device auth API.

- [ ] **Step 4: Load the module with an explicit cache-busting build id**

Add one script tag in `index.html` after the auth/admin modules. Do not change player or discovery load order.

- [ ] **Step 5: Run module test and frontend integration audit**

Run:
- `node tests/project-agent-pairing-admin.test.mjs`
- `node tests/frontend-integration-audit.test.mjs` if present under that exact name; otherwise run the existing frontend integration audit command from `.github/workflows/validate-frontend.yml`.

Expected: PASS.

- [ ] **Step 6: Commit and record handoff**

Commit message: `Add admin approval for project agent pairing`

Record SHA and the exact live-pairing procedure as the next step.

---

### Task 4: Deployment verification and first persistent pairing

**Files:**
- Modify: `.github/workflows/deploy-webtv-registry.yml`
- Modify: `WEBV2_CURRENT.md` only through the deployed project-agent API after pairing succeeds; do not add the canonical file to GitHub.

**Interfaces:**
- Consumes: deployed project-agent routes, persistent browser profile, existing `/api/project-status`.
- Produces: live persistent project-agent session and a canonical `WEBV2_CURRENT.md` update proving read/write continuity.

- [ ] **Step 1: Add safe unauthenticated deployment probes**

Extend Registry deployment verification to assert:
- anonymous project-agent checkpoint read returns `401`;
- anonymous project-agent checkpoint write returns `401`;
- representative existing Registry public behavior remains unchanged.

Do not print response bodies that could contain private checkpoint content.

- [ ] **Step 2: Run full PR validation**

Require all existing WebV2 validation steps to pass, including playback, Xtream, Discovery, browser smoke, startup, checkpoint write API, project-agent auth, and frontend integration.

- [ ] **Step 3: Merge only after GREEN and deploy Registry**

Verify the Registry deploy workflow completes successfully and `/api/project-status` reports the merged SHA.

- [ ] **Step 4: Perform one-time live pairing**

Sequence:
1. persistent project-agent browser calls `pair/start` and retains the completion secret only inside that browser run/profile;
2. human admin UI approves the displayed pairing id using the existing PIN/trusted-device flow;
3. persistent project-agent browser calls `pair/complete` and receives the HttpOnly project-agent cookie;
4. no credential is copied into chat.

- [ ] **Step 5: Verify persistence in a separate browser run**

Using the same persistent Browser Context Profile in a new run, call:
- `/api/project-agent/session` and require success;
- `/api/project-agent/checkpoints` and require success;
- `/api/project-agent/checkpoints/WEBV2_CURRENT.md` and require readable Markdown.

This is the proof that conversation changes no longer require re-pairing.

- [ ] **Step 6: Verify privilege isolation live**

Using the project-agent profile/session, attempt one representative non-project admin mutation and require `401`. Do not use a request that would alter data if an authorization bug existed; use a dry/no-op-safe validation route or invalid body that cannot mutate state after auth.

- [ ] **Step 7: Perform one controlled canonical update**

Read `WEBV2_CURRENT.md`, capture its `x-checkpoint-sha256`, update only the project-state/access/handoff sections using that SHA, then read it back and verify the new SHA/content. Previous revision must appear in private history metadata.

- [ ] **Step 8: Mark access layer DONE only after live proof**

Canonical state must record:
- implementation SHA;
- Registry deployed SHA;
- CI result;
- live pairing success;
- later-run persistent read success;
- scoped write success;
- privilege-isolation success;
- exact next WebV2 task.

Commit message for workflow changes: `Verify project agent access in production`

---

### Task 5: Final branch review and recovery check

**Files:**
- Review all files changed by Tasks 1-4.

**Interfaces:**
- Consumes: completed implementation and live verification evidence.
- Produces: merge-ready/release-complete state with no undocumented continuation gap.

- [ ] **Step 1: Run final full validation on the exact merge/deployed SHA**

Confirm all relevant GitHub Actions are green.

- [ ] **Step 2: Review security boundaries**

Verify no route accidentally accepts project-agent tokens through `requireAdmin()`, no private Markdown/secrets are logged, cookie flags/path are exact, and D1 revocation is enforced.

- [ ] **Step 3: Verify recovery from canonical state**

Start an independent persistent-browser read of `WEBV2_CURRENT.md` and confirm it contains enough current state to continue without relying on this conversation.

- [ ] **Step 4: Close with exact status**

Only call the feature DONE if implemented, deployed, paired, persistent across a later browser run, scoped correctly, and canonical handoff updated.
