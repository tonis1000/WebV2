# WebV2 Decision Log

## DEC-001 D1-primary My Playlist
Decision: D1 is the primary persistent My Playlist truth.
Reason: avoid fragmented cloud/local ownership.
Reconsider when: only if a replacement persistence model is explicitly designed and migrated.

## DEC-002 D1-authoritative Favorites after cloud read
Decision: after successful cloud read, D1 wins; localStorage is offline fallback.

## DEC-003 Browser Resolver retired
Decision: retire Browser Resolver/browser-resolved-official path; retain `official-api-resolver` and official-provider lane.

## DEC-004 Identity and Profile are separate
Decision: Channel Identity owns ids/names/aliases/rejects/official refs; Channel Profile owns canonical metadata/presentation/EPG mapping state.
Consequence: streams never belong in Channel Profile.

## DEC-005 WebV2 channel id != EPG provider id
Decision: provider XMLTV/tvg identifiers never redefine stable WebV2 identity.

## DEC-006 Hunt / Discovery / Verifier are separate logical roles
Decision: Hunt finds leads, Discovery normalizes candidates, Verifier verifies resolved media.
Consequence: deployment/file boundaries may evolve without collapsing responsibilities.

## DEC-007 Source Format Registry owns format identity/detection
Evidence: Phase E1 merge `d9dff4f7b251afe34605e9588b49dcb15d353951`.
Decision: generic HTTP transport is not confirmed playable media; unknown formats fail closed but remain inspectable/extensible.

## DEC-008 No big-bang cleanup
Decision: migrate one bounded responsibility at a time with parity tests and exact verification.

## DEC-009 DONE definition
Decision: DONE means **implemented + deployed + actually verified**. GitHub main alone is insufficient.

## DEC-010 Delete only with proof
Decision: obsolete-looking code/docs enter Cleanup first. Removal requires replacement/no-consumer/regression/deploy proof.
