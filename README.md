# Playwright Adventures

Modern browser automation scaffold with TypeScript + Python Playwright stacks, shared specs, and minimal MCP servers.

## Layout
- `common/specs` — shared YAML/Markdown journeys, selector policy, and testing philosophy.
- `js/` — TypeScript Playwright tests, page objects, journeys, and an MCP server.
- `py/` — Python Playwright tests, page objects, journeys, and an MCP sidecar.
- `Makefile` — shortcuts for installing deps, running tests, and starting MCP servers.

## Quickstart
### JavaScript/TypeScript
```bash
cd js
npm install
npx playwright install
npm run test:smoke
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
- MCP servers speak a minimal JSON-RPC style protocol over stdin/stdout and expose shared specs via `resources/list` and `resources/get`.
- Configure `BASE_URL` to point at the target app (defaults to `http://localhost:3000`) for Playwright contexts and MCP tooling.
