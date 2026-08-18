# Python Playwright + MCP Sidecar

## Setup
1. Install dependencies with [uv](https://github.com/astral-sh/uv):
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
```

## Starting the MCP server
```bash
uv run python -m playwright_adventures.mcp_server
```

The server registers browser tools, journey execution, and exposes shared specs from `../common/specs`. Extend `src/playwright_adventures/mcp_server/tools` and `src/playwright_adventures/mcp_server/resources` to add new capabilities.

Set `BASE_URL` to point at the application under test (defaults to `http://localhost:3000`), shared across page objects, tests, and MCP tooling.
