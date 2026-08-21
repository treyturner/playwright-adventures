# Playwright Adventures

Modern browser automation scaffold with TypeScript + Python Playwright stacks, shared specs, and MCP servers built on the official SDKs.

## Layout
- `common/specs` — shared YAML/Markdown journeys, selector policy, and testing philosophy.
- `fixture-app/` — dependency-free managed application implementing the shared journey contract.
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
npm run test:fixture
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

When `BASE_URL` is unset, each smoke suite starts and stops the managed fixture app automatically. Set `BASE_URL` to run the same journeys against another compatible application.

## Managed fixture application

The repository includes a deterministic local application for the shared homepage, login, dashboard, and account-detail journeys. It uses only the Node.js standard library and validates the demo credentials already used by both test stacks:

- Email: `demo@example.com`
- Password: `P@ssword123`

Run it manually at `http://localhost:3000` with `make start-fixture`. The fixture is test-only and is not intended as an application template or production service.

## Continuous integration

CI always builds both stacks, runs Python linting and type checks, exercises both MCP protocol suites, and runs both browser smoke suites against managed fixture instances. An additional live-browser job runs against another compatible application when the repository variable `BASE_URL` is configured or a `base_url` is supplied to a manual workflow run.

## MCP browser security

- `MCP_ALLOWED_ORIGINS` is an optional comma-separated document-navigation allowlist containing origins (scheme, host, and optional port). It defaults to the origin of `BASE_URL`; only absolute HTTP(S) URLs without embedded credentials are accepted. Redirects, frames, links, and popups are checked too. This controls document navigation only; it is not a complete network-egress policy for page resources, `fetch`, WebSockets, or other browser traffic.
- `MCP_SCREENSHOT_DIR` selects the screenshot output directory and defaults to `./screenshots`. Tool callers may provide a `.png`, `.jpg`, or `.jpeg` filename, but cannot supply absolute paths, subdirectories, traversal segments, or existing targets (including symbolic links). Screenshot files are created exclusively and never overwritten.
- Direct browser state is scoped to one stdio client. Every predefined journey runs in a fresh browser context that is closed after success or failure.
- MCP schemas bound URL, selector, form-value, screenshot-filename, user, and journey inputs before tool execution.

## Notes
- Both stacks prefer accessible selectors and `data-testid` anchors (see `common/specs/selectors.md`).
- Journeys mirror `common/specs/journeys.yaml` and can be invoked via MCP (`test.runJourney`).
- Both MCP servers negotiate the current protocol over stdio, expose browser and journey tools through `tools/list` and `tools/call`, and publish shared specs through `resources/list` and `resources/read`.
- Shared specs use stable `playwright-adventures://specs/<name>` resource URIs.
- Configure `BASE_URL` to point at another compatible target app. Browser smoke tests default to the managed fixture; MCP browser tooling defaults to `http://localhost:3000` and can use a manually started fixture there.
