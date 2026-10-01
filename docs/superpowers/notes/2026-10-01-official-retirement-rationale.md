# Official Discovery retirement rationale

We are retiring Official broadcaster discovery because the user can locate official broadcaster pages/streams manually without much effort, while the feature adds broadcaster-specific registries, API resolver logic, verifier coupling, tests and deployment checks.

We are keeping the other discovery capabilities because they solve harder or safer problems:

- Curated feeds reduce repeated manual source inspection.
- GitHub playlists surface public playlist sources that are not obvious to locate by hand.
- Recent Web finds fresh leads outside the fixed catalog.
- STRM discovery/resolution resolves technical indirection into actual media targets.
- Authorized Xtream searches explicit user-authorized accounts without exposing credentials.
- Hunt exploration covers wider non-obvious leads.
- New Xtream preview provides temporary inspection before persistence.
- Promotion policy protects the boundary between temporary findings and permanent saved state.
- Local scan remains background intelligence for dedupe and known-source awareness, not a visible lane.

This rationale is subordinate to the canonical cleanup decisions spec and does not mark runtime work DONE.
