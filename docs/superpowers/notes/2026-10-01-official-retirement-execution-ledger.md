# Official retirement execution ledger

Plan: `docs/superpowers/plans/2026-10-01-official-discovery-retirement.md`
Spec: `docs/superpowers/specs/2026-10-01-discovery-cleanup-decisions.md`
Base: `53467ff29cfcb7b71cae4e4a74fd9a4cde33e713`

- Ruling: The current harness has no local WebV2 worktree/command runner, so the isolated GitHub branch `design/discovery-orphan-cleanup` plus GitHub Actions is the execution workspace. Cost if wrong: CI-only iteration is slower, but production code remains isolated from `main`.
- Ruling: A temporary focused workflow may be used to execute `tests/official-discovery-retirement.test.mjs` during TDD and must be removed before final review. Cost if wrong: leaving it behind would create redundant CI surface.
- Rationale recorded: Official discovery is removed because it automates easy manual official-site lookup while adding broadcaster-specific maintenance. Retained discovery capabilities stay because they solve non-obvious discovery, format resolution, credential safety, dedupe or persistence-safety problems.
