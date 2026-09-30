# WebV2 Channel Profile Metadata Design

Date: 2026-09-30
Status: Design for review
Base verified SHA: `a39442b6fe5e199c7256548d9eb0c5c2acf95ee2`

## 1. Intent

WebV2 now has one shared Greek channel identity/matching core. The next architectural step is to attach stable channel metadata to that identity so names, logos, EPG mappings, categories, country/language and official references are managed consistently and can evolve independently of stream sources.

The design must make later changes easy. A logo provider may change without changing channel identity. An EPG feed may change without changing the channel id. Category labels may be adjusted without touching discovery or playback. A channel may move between Workers or use different tools later without changing its logical profile contract.

## 2. Core principle

A channel has one stable WebV2 identity and one logical Channel Profile. Stream sources are separate objects.

`channel identity -> channel profile -> metadata consumers`

`stream candidates -> verifier -> playback/save lifecycle`

The profile must never become a stream registry. It describes what the channel is, not where its current playable stream comes from.

## 3. Channel Profile model

Each promoted My Playlist channel should resolve to a profile with these logical sections:

```js
{
  id: 'mega',
  canonicalName: 'MEGA',
  officialNames: ['MEGA', 'MEGA TV'],
  aliases: [...],
  rejects: [...],
  officialRefs: [...],

  country: 'GR',
  language: 'el',

  category: {
    primary: 'Γενικά'
  },

  logo: {
    status: 'available',
    preferredUrl: 'https://...',
    sourceKind: 'official-site',
    sourceUrl: 'https://...',
    fallbacks: []
  },

  epg: {
    status: 'available',
    sourceId: 'gr-main',
    preferredId: 'mega',
    aliases: ['MEGA.gr', 'MegaChannel.gr', 'MEGA HD']
  }
}
```

The exact storage format may evolve during implementation, but the ownership and semantics above are stable.

## 4. Identity remains authoritative

The existing shared identity core remains the owner of:

- stable WebV2 channel id
- canonical name
- official names
- aliases
- collision/reject rules
- official references

Logo, EPG and category data may live beside identity data or in a directly keyed metadata registry, but they must join by the stable WebV2 channel id. No consumer should invent a second canonical channel identity.

## 5. Logo design

### 5.1 Goal

Logos should be deterministic, traceable and replaceable without editing playlists or stream records.

### 5.2 Priority

Preferred logo selection order:

1. official broadcaster/site/CDN logo
2. trusted maintained fallback
3. imported playlist/Xtream logo as a temporary candidate only
4. no logo / placeholder

A random `tvg-logo` from an external playlist must not silently become permanent canonical metadata.

### 5.3 Provenance

A canonical logo record should retain:

- preferred URL
- source kind such as `official-site`, `official-cdn`, `trusted-fallback`, `playlist-candidate`
- source/reference URL where practical
- optional fallback URLs
- explicit status: `available`, `pending`, or `unavailable`

Existing rendering sanitation/lazy-loading remains a display concern and should continue to validate URLs before rendering.

### 5.4 Missing logos

A channel may be promoted while logo status is explicitly `pending`. Missing metadata must be explicit, not an unexplained empty string.

## 6. Category design

User-visible categories are Greek and intentionally small in number.

Initial canonical categories:

- `Γενικά`
- `Ειδήσεις`
- `Αθλητικά`
- `Μουσική`
- `Περιφερειακά`

The profile stores one primary visible category. Future internal tags may be added for geography, network type or other filtering, but they are not required for the first migration and must not complicate the user-facing category system.

Current imported values such as `Greece`, `ΠΑΝΕΛΛΑΔΙΚΑ`, `ΚΕΝΤΡ. ΜΑΚΕΔΟΝΙΑ` and `Other` are source metadata, not canonical categories. They may be used as migration hints but do not define final classification.

## 7. Country and language

Profiles carry ISO-style stable country/language identifiers, for example:

- Greek channel: `country: 'GR'`, `language: 'el'`
- German channel: `country: 'DE'`, `language: 'de'`

Country/language are independent from category. A German sports channel can be `DE` + `de` + `Αθλητικά`.

This prevents the current Greek EPG implementation from becoming the permanent global architecture.

## 8. EPG design

### 8.1 Core rule

WebV2 channel id and EPG channel id are different concepts.

The stable WebV2 id must not change when an XMLTV provider changes its ids or naming.

### 8.2 Mapping model

Each profile may contain:

- `status`: `available`, `pending`, or `unavailable`
- `sourceId`: logical EPG source identifier, not a hardcoded provider URL in every channel
- `preferredId`: strongest known XMLTV/tvg id for that source
- `aliases`: known XMLTV ids/display names that are safe mappings for this channel

Example:

```js
epg: {
  status: 'available',
  sourceId: 'gr-main',
  preferredId: 'mega',
  aliases: ['MEGA.gr', 'MegaChannel.gr', 'MEGA HD']
}
```

For a channel with no known guide:

```js
epg: {
  status: 'pending',
  sourceId: null,
  preferredId: null,
  aliases: []
}
```

### 8.3 Resolution priority

EPG mapping should resolve in this order:

1. exact `preferredId`
2. exact known EPG alias
3. known official channel name
4. shared channel identity matcher as a constrained fallback
5. no match if confidence is ambiguous

Wrong EPG is worse than missing EPG. Ambiguous matches must fail closed.

### 8.4 Multiple countries and future EPG sources

The current `epg-proxy-gr` remains the verified Greek feed path, but the profile contract must support future sources such as `de-main`, `it-main`, etc.

A future EPG Source Registry may track for each source:

- source id
- country/language coverage
- provider URL or proxy endpoint
- XMLTV validation status
- refresh health
- last successful update
- channel/program counts
- mapping success statistics
- fallback priority

That source registry is future work and is not required to complete the first Channel Profile migration.

## 9. My Playlist vs Saved Playlists

### 9.1 My Playlist

My Playlist is the promoted/canonical channel collection. Each channel there should resolve to a full Channel Profile.

A profile may explicitly contain `logo.status = pending` or `epg.status = pending`, but the absence must be deliberate and machine-readable.

### 9.2 Saved Playlists

Saved Playlists remain external/imported collections. Their channels may continue to carry source metadata such as:

- `tvg-name`
- `tvg-logo`
- `group-title`
- `tvg-id`
- Xtream category/name/icon fields

These values are temporary source metadata. They may help preview, matching and EPG lookup, but they do not automatically become canonical WebV2 metadata.

If a Saved Playlist channel is promoted to My Playlist, WebV2 creates/resolves a proper Channel Profile and applies the canonical rules.

This allows large foreign playlists to remain lightweight without creating thousands of permanent catalog records.

## 10. New-channel contract

A newly promoted My Playlist channel must have or explicitly declare:

- stable WebV2 id
- canonical name
- at least one official name
- aliases
- official reference(s)
- reject/collision rules where needed
- country
- language
- one canonical Greek user-facing category
- logo status and provenance if available
- EPG status and mapping if available

`pending` is allowed for logo/EPG. Silent unknown/empty metadata is not the target state.

Tests should enforce the profile schema for every promoted canonical channel.

## 11. Migration strategy

Do not replace all metadata systems at once.

### Phase A: profile schema and metadata registry

- extend or companion-key the current shared identity registry by stable channel id
- define validators
- encode current 24 My Playlist profiles
- classify current categories into the five Greek categories
- preserve current UI behavior

### Phase B: logo ownership

- make canonical profile logo take precedence for My Playlist
- retain source playlist/Xtream logo as temporary fallback/candidate
- preserve current `logo-utils.js` rendering sanitation
- explicitly mark missing logos

### Phase C: EPG ownership

- remove duplicated channel canonicalization/alias ownership from `src/core/epg.js`
- consume shared identity/profile metadata for mapping
- preserve current verified Greek XMLTV source behavior
- add parity tests for current Greek mappings and collision cases

### Phase D: imports and promotion

- make imported M3U/Xtream/Saved Playlist metadata clearly temporary
- on promotion to My Playlist, resolve/create canonical profile metadata
- keep stream sources separate from profile metadata

### Phase E: future multi-country EPG registry

Only after a second country/source is needed, design the EPG Source Registry and source selection/fallback policy. Do not prebuild a large provider framework before there is a real second source to support.

## 12. Current-state observations that motivate this design

- The current M3U parser imports `tvg-logo` and `group-title` directly as channel metadata.
- My Playlist currently stores `id`, `name`, `tvgId`, `logo`, and `groupName`; several channels have empty logo values and category labels use mixed semantics/languages.
- `src/core/epg.js` still owns a separate list of known channel keys and its own alias/canonicalization logic.
- `src/config.js` still exposes a separate legacy `CHANNEL_ALIASES` map.
- `src/logo-utils.js` safely renders/sanitizes logos but does not define canonical logo provenance.
- The new `src/core/channel-identity-gr.js` is already the shared identity/matching authority for active Hunt/Discovery callers and should be reused rather than duplicated.

## 13. Proof criteria

The Channel Profile migration is not DONE until:

- the profile schema/validator has regression tests
- all current 24 My Playlist channels pass the schema
- user-visible categories are only the approved Greek basic categories
- existing channel identity collision tests remain green
- My Playlist behavior remains D1-primary
- existing Saved Playlist cloud/local reconciliation remains unchanged
- current channel logos do not regress unless intentionally replaced with a documented canonical source
- current Greek EPG mappings have parity tests before ownership moves
- ambiguous EPG matching fails closed
- full frontend validation, browser smoke, startup and integration audit are green
- relevant deploy workflows and Pages are successful
- live My Playlist remains complete after deployment
- live EPG remains valid after the EPG migration phase

Each phase must be independently deployable and reversible. No phase may require a simultaneous rewrite of Source Hunt, Source Discovery, Source Verifier or Player.

## 14. Out of scope for the first implementation

- building a multi-country EPG provider marketplace
- automatically crawling the web for every logo
- automatically trusting playlist categories as canonical
- storing stream URLs inside Channel Profiles
- merging Hunt/Discovery/Verifier Workers
- changing playback behavior
- changing PIN/auth architecture

## 15. Design decision summary

The stable unit is the WebV2 channel id. Identity, metadata and streams are separated:

- Identity answers: `which channel is this?`
- Channel Profile answers: `what is this channel, how should it be presented, and how is its EPG mapped?`
- Source/Verifier lifecycle answers: `where can it play from and has that media been proven?`

This separation is intended to let WebV2 change logos, EPG providers, categories, Workers and discovery tools later without rewriting channel identity or playback state.
