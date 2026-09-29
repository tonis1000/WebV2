# WebV2 Project Agent Access Design

Date: 2026-09-29
Status: DESIGN FOR REVIEW
Base verified commit: `5f9b61cb79cdfd4a89b0251b948d9e92affb37a0`

## 1. Problem

`WEBV2_CURRENT.md` is the private canonical current state of WebV2. The Registry now supports authenticated checkpoint reads and safe writes with SHA preconditions, history snapshots, and race protection.

The remaining gap is authorization for the project agent. The agent must be able to read and update project state across conversations without receiving the human PIN or `ADMIN_TOKEN` in chat and without gaining broad runtime-admin access to unrelated data.

This access must also support reliable handoff: long work must be recoverable from the latest verified checkpoint rather than depending on one conversation staying alive.

## 2. Goals

The project agent must be able to:

- read `WEBV2_CURRENT.md` before WebV2 work;
- update `WEBV2_CURRENT.md` after verified milestones;
- list project checkpoints and read checkpoint history metadata;
- read project/deployment status;
- use optimistic concurrency so stale sessions cannot overwrite newer state;
- keep authorization across conversations through the persistent browser profile;
- extend later to additional project-state APIs without redesigning authentication.

The human owner must never need to paste the PIN, `ADMIN_TOKEN`, or another master credential into chat.

## 3. Non-goals

The project-agent credential must not authorize:

- My Playlist mutations;
- Favorites mutations;
- Health mutations;
- Saved Playlist mutations;
- Xtream credentials or lifecycle operations;
- generic D1 access;
- Cloudflare account administration;
- arbitrary Registry admin endpoints.

Those remain under the existing human/admin authorization model unless a future, explicit requirement adds a narrowly scoped project-state permission.

## 4. Chosen approach: one-time pairing + scoped persistent session

Use a dedicated project-agent authorization flow rather than sharing the existing admin bearer token.

### 4.1 Pairing start

The persistent project-agent browser requests a one-time pairing challenge from the Registry.

The Registry creates a short-lived D1 record containing:

- random pairing id;
- hashed one-time completion secret;
- creation time;
- expiry time, approximately 5 minutes;
- approval state;
- used state.

The raw completion secret is returned only to the initiating agent session and is never stored in plaintext in D1.

### 4.2 Human approval

The owner approves the pending pairing from the normal WebV2 admin surface using the existing PIN-authenticated session.

The approval endpoint requires normal Registry admin authorization.

The owner approves a specific pairing id. The owner does not enter the PIN into the agent session and does not send the PIN through chat.

### 4.3 Pairing completion

The persistent agent browser completes the approved pairing with the original one-time completion secret.

If the pairing is valid, approved, unexpired, and unused, the Registry issues a scoped project-agent session and marks the pairing used.

The session is stored as a Secure, HttpOnly, SameSite=Strict cookie in the persistent browser profile.

The cookie is scoped to the dedicated project-agent API path rather than the whole Registry.

## 5. Dedicated project-agent API namespace

Do not reuse the existing broad admin endpoints directly with the scoped cookie.

Expose project-state operations through a dedicated namespace, for example:

- `POST /api/project-agent/pair/start`
- `POST /api/project-agent/pair/approve` — normal admin auth required
- `POST /api/project-agent/pair/complete`
- `GET /api/project-agent/session`
- `DELETE /api/project-agent/session`
- `GET /api/project-agent/status`
- `GET /api/project-agent/checkpoints`
- `GET /api/project-agent/checkpoints/{name}`
- `PUT /api/project-agent/checkpoints/{name}`
- `GET /api/project-agent/checkpoints/{name}/history`

Internally these routes reuse the existing checkpoint and project-status functions. They must not route arbitrary Registry requests.

Future project-state features should normally be added under this namespace so the authorization scope can expand deliberately without becoming a master key.

## 6. Session model

The project-agent session payload contains at minimum:

- token version;
- issued-at time;
- expiry time;
- scope identifier such as `project-state`;
- random session id.

The token is cryptographically signed. It may use the Registry signing infrastructure, but validation must explicitly require the `project-state` scope. A project-agent token must never satisfy `requireAdmin()`.

The recommended lifetime is long enough to survive normal conversation changes, while remaining revocable. The exact duration should be selected during implementation together with a revocation strategy.

A D1 session/revocation record is preferred over an irrevocable purely stateless long-lived token so access can be terminated without rotating the human admin secret.

## 7. Security properties

Required properties:

1. Anonymous project-agent project-state requests return `401`.
2. Existing human PIN/admin behavior remains unchanged.
3. A project-agent session cannot pass `requireAdmin()`.
4. Project-agent routes cannot access My Playlist, Favorites, Health, Saved Playlists, Xtream, or arbitrary D1 operations.
5. Pairing challenges expire and are single-use.
6. Pairing completion requires both human approval and possession of the initiating completion secret.
7. No PIN or admin token is returned to the agent.
8. No secrets or private checkpoint Markdown are written to CI logs.
9. Checkpoint writes continue to require `expectedSha256` for existing state.
10. Existing atomic checkpoint history/CAS behavior remains the persistence boundary.

## 8. Continuous handoff rule

WebV2 work follows a recoverable checkpoint rule.

Before a large or long-running change:

- read current project state;
- record the current problem and success criteria if not already present;
- know the latest safe rollback/verified SHA.

After every meaningful verified milestone:

- update `WEBV2_CURRENT.md` with implementation status;
- record relevant SHA(s);
- record deployment state;
- record verification evidence;
- record blockers or partial state;
- record the exact next step.

If work stops midway, the state is marked `IN PROGRESS`, never `DONE`.

`DONE` continues to mean implemented + deployed + actually verified.

This rule is intended to make a new conversation resume from project state rather than repeat the audit from the beginning.

## 9. Verification plan

Implementation is not complete until all of the following are verified.

### Automated tests

- pairing start creates an expiring challenge;
- approval requires normal admin authentication;
- unapproved completion fails;
- wrong completion secret fails;
- expired pairing fails;
- pairing can be completed only once;
- successful completion issues project-state session;
- project-state session can read checkpoint metadata/content;
- project-state session can update `WEBV2_CURRENT.md` using current SHA;
- stale SHA still returns `409`;
- project-state session cannot call representative admin endpoints such as My Playlist write, Favorites write, Health write, or Saved Playlist write;
- revoked session returns `401`.

### Deployment verification

After deployment:

- anonymous project-agent checkpoint read/write returns `401`;
- existing anonymous/admin Registry behavior is unchanged;
- live pairing is completed once using the persistent browser profile;
- the persistent profile can read `WEBV2_CURRENT.md` in a later independent browser run;
- the persistent profile can perform one controlled canonical update with SHA precondition;
- the same profile is denied on a representative non-project admin mutation;
- `/api/project-status` matches the deployed Registry commit.

## 10. Rollback

The access layer is additive.

If it fails verification:

- disable/remove project-agent routes;
- revoke project-agent sessions/pairings;
- retain the existing PIN/admin checkpoint API;
- do not modify or delete canonical checkpoint content.

The already verified checkpoint write API remains the fallback administrative path.

## 11. Implementation boundary

Expected primary files:

- `workers/webtv-registry.js`
- Registry Worker regression tests
- `.github/workflows/validate-frontend.yml`
- `.github/workflows/deploy-webtv-registry.yml`
- minimal WebV2 admin UI only if needed for pairing approval

No Player, Source Hunt, Discovery, TV Cache, Verifier, Xtream, or EPG behavior should change as part of this work.

## 12. Next step after design approval

Create a detailed implementation plan with TDD order, then implement on a separate feature branch. The first production-code milestone should be pairing/session primitives with failing tests before implementation.
