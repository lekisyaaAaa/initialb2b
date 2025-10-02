Run helper scripts for CI and local smoke checks

run-no-debug.js
- Wrapper to run Node scripts with NODE_DEBUG/DEBUG cleared.
- Usage: node run-no-debug.js ./scripts/check-console-visibility.js

check-console-visibility.js
- Headless Puppeteer script that checks the SmartBin Console button visibility.
- Outputs files to the `scripts/` directory:
  - check-console-visibility.result.json  (boolean flags publicHas/adminHas + errors)
  - check-console-visibility-public.png
  - check-console-visibility-admin.png
  - check-console-visibility-error.png

run-frontend-and-check.ps1
- PowerShell helper that builds the frontend, starts server, runs the visibility check via `run-no-debug.js`, and prints result.json if present.
- Usage (PowerShell):
  cd scripts
  .\run-frontend-and-check.ps1
