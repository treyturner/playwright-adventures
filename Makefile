.PHONY: install-js install-py test-fixture test-js test-mcp-js test-py start-fixture start-mcp-js start-mcp-py test-all

install-js:
	cd js && npm install

install-py:
	cd py && uv sync

test-fixture:
	cd js && npm run test:fixture

test-js:
	cd js && npm run test:smoke

test-mcp-js:
	cd js && npm run test:mcp

test-py:
	cd py && uv run pytest

start-fixture:
	node fixture-app/server.mjs

start-mcp-js:
	cd js && npm run start:mcp

start-mcp-py:
	cd py && uv run python -m playwright_adventures.mcp_server

test-all: test-fixture test-mcp-js test-js test-py
