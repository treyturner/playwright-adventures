# Playwright Adventures

Modern browser automation scaffold with TypeScript + Python Playwright stacks, shared specs, and MCP servers built on the official SDKs.

## Layout
- `common/specs` — shared YAML/Markdown journeys, selector policy, and testing philosophy.
- `js/` — TypeScript Playwright tests, page objects, journeys, and an MCP server.
- `py/` — Python Playwright tests, page objects, journeys, and an MCP sidecar.
- `Makefile` — shortcuts for installing deps, running tests, and starting MCP servers.

## Quickstart
### JavaScript/TypeScript
Requires Node.js 20 or newer.

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

## Notes
- Both stacks prefer accessible selectors and `data-testid` anchors (see `common/specs/selectors.md`).
- Journeys mirror `common/specs/journeys.yaml` and can be invoked via MCP (`test.runJourney`).
- Both MCP servers negotiate the current protocol over stdio, expose browser and journey tools through `tools/list` and `tools/call`, and publish shared specs through `resources/list` and `resources/read`.
- Shared specs use stable `playwright-adventures://specs/<name>` resource URIs.
- Configure `BASE_URL` to point at the target app (defaults to `http://localhost:3000`) for Playwright contexts and MCP tooling.
