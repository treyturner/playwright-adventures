# Python Playwright + MCP Sidecar

## Setup
1. Install runtime and development dependencies with [uv](https://github.com/astral-sh/uv):
   ```bash
   uv sync
   ```
2. Download Playwright browsers if needed:
   ```bash
   uv run playwright install
   ```

## Running tests
```bash
uv run pytest
uv run mypy src tests
uv run ruff check .
uv run ruff format --check .
```

The smoke tests start and stop the repository's managed fixture app on an available local port when `BASE_URL` is unset. This requires the repository-pinned Node.js runtime. Set `BASE_URL` to run against another application that implements the shared journey contract.

Journey IDs and steps come from `../common/specs/journeys.yaml`. After changing that file, run `make generate-journeys` from the repository root to refresh the committed Python and TypeScript adapters; the JavaScript build and CI reject stale generated files.

For a runtime-only environment, use `uv sync --no-dev`.

The MCP integration tests exercise both an in-memory SDK transport and a real stdio subprocess.

## Starting the MCP server
```bash
uv run python -m playwright_adventures.mcp_server
```

The official MCP Python SDK server registers browser tools, journey execution, and shared specs from `../common/specs`. The specs are available at stable `playwright-adventures://specs/<name>` resource URIs. Extend `src/playwright_adventures/mcp_server/tools` and `src/playwright_adventures/mcp_server/resources` to add new capabilities.

Set `BASE_URL` to point at another compatible application. MCP tooling defaults to `http://localhost:3000`; run `make start-fixture` from the repository root to use the managed fixture there.
