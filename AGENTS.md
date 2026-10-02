# Agent guide

- Write a failing test before you change behavior.
- Before you report a change as done, run `npm test`, `npm run typecheck`, and `npm run build`. If the change touches `src/app`, `src/components`, or `src/hooks`, also run `npm run test:e2e`.
- Before `npm run test:e2e`, stop every `next dev` that runs from this checkout. Playwright starts its own dev server on port 3000, and Next.js 16 refuses a second dev server in one directory. The refusal message names the PID to stop. If port 3000 serves another checkout, stop that server too, because Playwright reuses any server on port 3000.
- Before you check the app in a browser, read [docs/browser-testing.md](docs/browser-testing.md).
- Put decisions and measurements that the code cannot show in [docs/architecture.md](docs/architecture.md).
