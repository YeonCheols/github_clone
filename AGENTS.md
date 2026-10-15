# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Repository-local authentication

The user requires all YeonCheols authentication and CLI configuration to remain in this repository's `.git` directory. Never sign in, switch accounts, or configure credential helpers globally. Use `scripts/github-local.mjs` and `.git/gh-local`. Request user authentication only when local credentials are actually missing or expired; a sandbox/network error does not establish invalid credentials. Do not expose tokens to browser code or logs. The app's GitHub mode uses official API requests; snapshot mode keeps edits local. Do not issue test writes to the upstream repository.

## Expanded reconstruction scope

The user now wants the GitHub app's major screens and journeys, including the signed-in account home at the empty/root URL, rather than only the REA repository. Use the official REA investigation skill and retain observed screenshots/behavior as evidence. Collect the home and directly connected navigation URLs first, then investigate feature groups. Do not claim entire-app coverage from one home capture or infer parity from API availability. Preserve existing repository captures and implementation while adding the home route.
