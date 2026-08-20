# Playwright Adventures

Modern browser automation scaffold with TypeScript + Python Playwright stacks, shared specs, and MCP servers built on the official SDKs.

## Layout
- `common/specs` — shared YAML/Markdown journeys, selector policy, and testing philosophy.
- `js/` — TypeScript Playwright tests, page objects, journeys, and an MCP server.
- `py/` — Python Playwright tests, page objects, journeys, and an MCP sidecar.
- `Makefile` — shortcuts for installing deps, running tests, and starting MCP servers.
- `.github/workflows/ci.yml` — reproducible build, quality, protocol, and optional live smoke checks.

## Toolchains

- Node.js 24.19.0 is pinned in `.node-version`; npm 12.0.2 is pinned through `packageManager`.
- Python 3.14.7 is pinned in `.python-version`.
- CI pins uv 0.12.5 and installs dependencies exclusively from the npm and uv lockfiles.

## Quickstart
### JavaScript/TypeScript
Use the Node.js and npm versions pinned above.

```bash
cd js
npm install
npx playwright install
npm run test:smoke
npm run test:mcp
npm run start:mcp
```

### Python
```bash
cd py
uv sync
uv run playwright install
uv run pytest
uv run python -m playwright_adventures.mcp_server
```

## Continuous integration

CI always builds both stacks, runs Python linting and type checks, exercises both MCP protocol suites, and verifies smoke-test discovery. Live browser smoke tests run when the repository variable `BASE_URL` is configured or a `base_url` is supplied to a manual workflow run.

## MCP browser security

- `MCP_ALLOWED_ORIGINS` is an optional comma-separated navigation allowlist containing origins (scheme, host, and optional port). It defaults to the origin of `BASE_URL`; only absolute HTTP(S) URLs without embedded credentials are accepted. Redirects, frames, links, and popups are checked too.
- `MCP_SCREENSHOT_DIR` selects the screenshot output directory and defaults to `./screenshots`. Tool callers may provide a `.png`, `.jpg`, or `.jpeg` filename, but cannot supply absolute paths, subdirectories, traversal segments, or symbolic-link targets.
- Direct browser state is scoped to one stdio client. Every predefined journey runs in a fresh browser context that is closed after success or failure.
- MCP schemas bound URL, selector, form-value, screenshot-filename, user, and journey inputs before tool execution.

## Notes
- Both stacks prefer accessible selectors and `data-testid` anchors (see `common/specs/selectors.md`).
- Journeys mirror `common/specs/journeys.yaml` and can be invoked via MCP (`test.runJourney`).
- Both MCP servers negotiate the current protocol over stdio, expose browser and journey tools through `tools/list` and `tools/call`, and publish shared specs through `resources/list` and `resources/read`.
- Shared specs use stable `playwright-adventures://specs/<name>` resource URIs.
- Configure `BASE_URL` to point at the target app (defaults to `http://localhost:3000`) for Playwright contexts and MCP tooling.
