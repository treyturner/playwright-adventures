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

The MCP integration tests exercise both an in-memory SDK transport and a real stdio subprocess.

## Starting the MCP server
```bash
uv run python -m playwright_adventures.mcp_server
```

The official MCP Python SDK server registers browser tools, journey execution, and shared specs from `../common/specs`. The specs are available at stable `playwright-adventures://specs/<name>` resource URIs. Extend `src/playwright_adventures/mcp_server/tools` and `src/playwright_adventures/mcp_server/resources` to add new capabilities.

Set `BASE_URL` to point at the application under test (defaults to `http://localhost:3000`), shared across page objects, tests, and MCP tooling.
