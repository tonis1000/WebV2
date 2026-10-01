# Xtream All-Known Identity Regression

Problem: the live browser proof showed that `All known sources` can miss an already-known My Playlist source for an unprofiled Xtream channel when My Playlist has normalized the local row `id` but preserved the provider identity in `originalId`.

Reproduction identity:
- provider tvg/original id: `webtv.test.5000.0001`
- My Playlist local normalized id: `webtv-test-5000-0001`
- My Playlist preserved originalId: `webtv.test.5000.0001`

Expected: the known-source collector recognizes the My Playlist row as the same channel and merges its known source with the newly materialized selected Xtream source.

Proof: `tests/known-source-collector.test.mjs` must fail before the fix and pass afterward; full frontend validation must pass.
