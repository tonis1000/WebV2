# WebV2 Tooling Matrix

Exact pricing/limits are time-sensitive. **Verified: 2026-09-30; re-check before relying on exact cost/limits.** Never store secrets or wallet credentials here.

## Preferred order
1. Project-native API/connector
2. GitHub connector/API
3. Free read/search/fetch path
4. Metered browser/agent only when materially necessary and justified

## GitHub connector/API
Use for: canonical `WEBV2_CURRENT.md`, Project Brain files, commits, branches, PRs, Actions/workflow evidence.
Strength: exact repository state, diff/review history, and commit evidence.
Rule: GitHub `main/WEBV2_CURRENT.md` is canonical project current-state truth after the ownership migration. GitHub state still does not itself prove production deployment; compare with `/api/project-status` and component-specific deployment/live evidence.
Observed E3a behaviors:
- `update_file` replaces the whole file; it is not a small patch API. For a large file, fetch/read the exact branch content before replacement.
- Connector responses for very large files may be visually truncated while the underlying response resource still contains more content. Use the response resource in line ranges to recover exact content instead of reconstructing from a truncated display.
- a newly added PR workflow may take a short time before it appears in workflow-run queries; absence on the first read is not proof it did not trigger.
- the connector safety classifier may occasionally reject a larger benign test-file write before GitHub receives it. A smaller equivalent fixture preserving the same assertions can avoid the false positive; do not weaken the test contract just to satisfy the tool.
- content writes are SHA/CAS-protected. A 409 after another branch edit is a stale-read signal, not permission to force overwrite; re-fetch the latest file, reconcile, then write against the new SHA.

## GitHub Actions as execution fallback
Use when: local/container source execution is blocked by environment/network limitations but branch writes and Actions are available.
Proven E3a method:
1. put the RED test on an isolated PR branch;
2. wire it into a narrow temporary PR workflow if the permanent workflow does not yet execute it;
3. inspect job steps/logs to prove the expected RED cause;
4. implement minimal GREEN;
5. move the tests into permanent project workflows;
6. delete the temporary harness before merge.
Strength: deterministic repository-native Node/browser test environment with reviewable logs.
Caution: PR Actions normally check out GitHub's synthetic PR merge ref, so use the PR head SHA and workflow metadata deliberately when comparing evidence.

## Registry API
Use `/api/project-status` for Registry deployment truth.
Use scoped project-agent routes `/api/project-agent/checkpoints` and `/api/project-agent/checkpoints/WEBV2_CURRENT.md` for D1 mirror/history inspection when a valid project-agent session exists.
Admin alternative: `/api/project-checkpoints` remains an admin/bypass surface, not the default scoped path.
Strength: persistent application state, deploy-status surface, and CAS checkpoint/history model.
Rule: Registry/D1 CURRENT is mirror/history/fallback, not canonical project-current authority. Registry project status is Registry deployment truth, not universal Worker truth.

## Standard web/fetch path
Use for: public current research and normal HTTP reads.
Known issue: some ChatGPT web retrieval paths may reject `*.workers.dev`; tool refusal is not proof of server auth failure.

## TinyFish Search
Current status on 2026-09-30: free tier/capability available; re-check exact quotas before relying on them.
Use when a current web search materially helps and native web/connector is unsuitable.

## TinyFish Fetch
Current status on 2026-09-30: free fetch capability available; re-check exact quotas.
Use for known URL content extraction when it avoids metered browser automation.
Observed WebV2 limitation on 2026-09-30: Fetch reached Registry `workers.dev` URLs during E2/governance preflight but did not reliably surface the raw API body needed for checkpoint SHA/content reconciliation. Do not treat successful reachability alone as a complete mirror read.

## TinyFish Browser
Metered. Use only when browser interaction is materially required and cheaper/free paths cannot accomplish the task.
Known success: reached Registry `workers.dev` endpoints when another retrieval path refused the host and returned exact project-status/checkpoint/current content.
Known limitation: generic browser automation may not expose arbitrary PUT JSON. The project has the scoped HTML CAS editor `/api/project-agent/checkpoints/WEBV2_CURRENT.md/edit` for D1 CURRENT mirror writes when a valid project-agent session is available.

## TinyFish Agent
Metered. Use only for a real interaction/automation need, not routine reads that Search/Fetch/native APIs can do.

## TinyFish Monitor
Metered per run. Use only for explicit recurring monitoring needs.

## Container/runtime tools
Useful for local syntax/tests/file generation when source is locally available. Container network access may differ from connector/web access; a DNS failure there does not prove remote service failure.
Observed E2/E3a limitation: local clone/raw GitHub access can fail with DNS/name-resolution errors even while the GitHub connector and GitHub Actions work normally. In that condition, do not classify GitHub as down. Prefer the repository connector plus Actions-backed TDD rather than repeatedly retrying local network access.

## Rule for new tools
Record: purpose, cost model, limits, success path, failure mode, security constraints, last verified date. Promote a proven method into Playbooks.
