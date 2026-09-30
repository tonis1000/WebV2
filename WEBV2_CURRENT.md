# WebV2 Current State Pointer

This repository file is **not canonical current-state content**. It is a pointer only and intentionally contains no production commit SHA.

Canonical current state lives in Registry / D1. For routine reads with the persistent scoped project-agent session use:
- `/api/project-status`
- `/api/project-agent/checkpoints`
- `/api/project-agent/checkpoints/WEBV2_CURRENT.md`

Admin checkpoint routes under `/api/project-checkpoints` require Registry admin authentication unless a temporary maintenance bypass is active; they are not the normal least-privilege Project Brain read path.

Before WebV2 work, read the entire live D1 checkpoint and compare it with GitHub `main` and relevant component deployment evidence. If the live checkpoint cannot be read, state that limitation explicitly and use the latest verified fallback only temporarily.
