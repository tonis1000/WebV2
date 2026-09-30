# WebV2 Tooling Matrix

Exact pricing/limits are time-sensitive. **Verified: 2026-09-30; re-check before relying on exact cost/limits.** Never store secrets or wallet credentials here.

## Preferred order
1. Project-native API/connector
2. GitHub connector/API
3. Free read/search/fetch path
4. Metered browser/agent only when materially necessary and justified

## GitHub connector/API
Use for: repo files, commits, branches, PRs, Actions/workflow evidence.
Strength: exact repository state and commit evidence.
Limit: GitHub state does not itself prove production deployment.

## Registry API
Use for: `/api/project-status`, `/api/project-checkpoints`, canonical current checkpoint.
Strength: project current-state/deploy-status surface and CAS checkpoint model.
Rule: Registry project status is Registry deployment truth, not universal Worker truth.

## Standard web/fetch path
Use for: public current research and normal HTTP reads.
Known issue: some ChatGPT web retrieval paths may reject `*.workers.dev`; tool refusal is not proof of server auth failure.

## TinyFish Search
Current status on 2026-09-30: free tier/capability available; re-check exact quotas before relying on them.
Use when a current web search materially helps and native web/connector is unsuitable.

## TinyFish Fetch
Current status on 2026-09-30: free fetch capability available; re-check exact quotas.
Use for known URL content extraction when it avoids metered browser automation.

## TinyFish Browser
Metered. Use only when browser interaction is materially required and cheaper/free paths cannot accomplish the task.
Known success: reached Registry `workers.dev` endpoints when another retrieval path refused the host.
Known limitation: the browser-style attempt used in this project did not expose arbitrary PUT JSON needed for checkpoint write.

## TinyFish Agent
Metered. Use only for a real interaction/automation need, not routine reads that Search/Fetch/native APIs can do.

## TinyFish Monitor
Metered per run. Use only for explicit recurring monitoring needs.

## Container/runtime tools
Useful for local syntax/tests/file generation when source is locally available. Container network access may differ from connector/web access; a DNS failure there does not prove remote service failure.

## Rule for new tools
Record: purpose, cost model, limits, success path, failure mode, security constraints, last verified date. Promote a proven method into Playbooks.
