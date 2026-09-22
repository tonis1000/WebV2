# WebTV Registry deployment

The production Worker source is `workers/webtv-registry.js`.

Deployment is handled by `.github/workflows/deploy-webtv-registry.yml`.

## One-time GitHub secret

Create repository secret `CLOUDFLARE_API_TOKEN`.

The Cloudflare token should be scoped only to account `c2275f5f50ccabe425a5cafe68128a9a` and should have:

- Workers: Editor for the existing `webtv-registry` Worker (or the corresponding Workers edit permission)
- D1: Read, so the workflow can discover the existing D1 database ID

The workflow does not store the token or D1 database ID in the repository.

If automatic D1 discovery is ambiguous, optionally add repository secret `CLOUDFLARE_D1_DATABASE_ID`. Normally this is not needed.

## What happens on deploy

1. GitHub checks out the repo.
2. Wrangler lists the existing D1 databases and resolves the WebTV Registry database.
3. A temporary Wrangler config is generated only inside the GitHub Actions runner.
4. `workers/webtv-registry.js` is deployed to the existing `webtv-registry` Worker.
5. Existing Worker secrets `ADMIN_TOKEN` and `ADMIN_PIN` are required and preserved.
6. Existing dashboard variables are preserved with `--keep-vars`.
7. The workflow calls `https://webtv-registry.atonis.workers.dev/api/status` and verifies Registry v1.4 and 180-day trusted sessions.

## Triggers

The workflow can be started manually with **Actions → Deploy WebTV Registry Worker → Run workflow**.

After setup, changes to `workers/webtv-registry.js` on `main` deploy automatically.
