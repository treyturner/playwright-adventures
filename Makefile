.PHONY: install-js install-py generate-journeys check-journeys test-journeys test-fixture test-js test-mcp-js test-py start-fixture start-mcp-js start-mcp-py test-all

install-js:
	cd js && npm install

install-py:
	cd py && uv sync

generate-journeys:
	cd js && npm run generate:journeys

check-journeys:
	cd js && npm run check:journeys

test-journeys:
	cd js && npm run test:journeys

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

test-all: test-journeys test-fixture test-mcp-js test-js test-py
