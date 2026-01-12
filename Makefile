.PHONY: install-js install-py test-js test-py start-mcp-js start-mcp-py test-all

install-js:
	cd js && npm install

install-py:
	cd py && uv sync

test-js:
	cd js && npm run test:smoke

test-py:
	cd py && uv run pytest

start-mcp-js:
	cd js && npm run start:mcp

start-mcp-py:
	cd py && uv run python -m mcp_server.main

test-all: test-js test-py
