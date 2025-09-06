Title: infra: CI + security — prevent .env commits, add pre-commit hook, integration smoke

Summary
-------
This PR adds CI and local safety measures to prevent committing environment files and to run a lightweight integration smoke test in CI.

Changes
-------
- .github/workflows/check-no-env.yml — CI job that fails if `.env` files are present in the repository.
- .github/workflows/smoke-integration.yml — integration smoke workflow that provisions Postgres and runs the repository smoke script.
- .githooks/pre-commit — local pre-commit hook to block `.env` files from being committed (opt-in: enable with `git config core.hooksPath .githooks`).
- README.DEV.md — documents how to enable hooks and small runbook notes.
- Untrack `backend/.env` and `frontend/.env` from the repository index to avoid leaking secrets.

Why
---
- Prevent accidental secret leakage via `.env` files.
- Provide a reproducible CI smoke check that exercises backend + frontend + auth flow against Postgres.

Notes for reviewers
------------------
- The integration workflow requires the `JWT_SECRET` secret to be set in the repository (Settings → Secrets → Actions) for the seeder and token signing. Add it before running the integration job, or the seeder will default to a development secret.
- The workflow uses a Postgres service container at 5432; jobs may need timeouts adjusted on slow runners.
- I removed tracked `.env` files from the repository index — they remain locally but are no longer in HEAD.

How to test locally
-------------------
1. Enable local hooks (optional):

   git config core.hooksPath .githooks

2. Run the start helper (Windows PowerShell):

   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -NoInstall -Verbose

3. Or run the repo smoke script:

   npm run smoke

Open PR
-------
Open this URL to review/submit the PR:
https://github.com/lekisyaaAaa/initialb2b/compare/master...infra/ci-security?expand=1

If you want, I can open the PR programmatically — I will need a GitHub token with repo scope to do that.
