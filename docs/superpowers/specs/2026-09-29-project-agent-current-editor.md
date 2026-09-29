# WEBV2_CURRENT Browser Editor

Purpose: let the already scoped project-agent browser session create and update only `WEBV2_CURRENT.md` when raw HTTP PUT is unavailable to browser automation.

Security contract:
- route stays under `/api/project-agent`;
- a valid project-agent session is required before read or write;
- no general Registry admin privilege is added;
- form saves are forwarded to the existing checkpoint PUT endpoint;
- optimistic concurrency remains enforced by `expectedSha256`;
- the editor is limited to `WEBV2_CURRENT.md`.

Success proof: full WebV2 validation must pass, then production must create/read `WEBV2_CURRENT.md` through the scoped session and return its SHA-256.