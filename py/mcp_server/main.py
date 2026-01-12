from __future__ import annotations

import asyncio
import dataclasses
import json
import signal
import sys
from typing import Any, Awaitable, Callable, Dict

from .resources.specs_resource import load_spec_resources
from .tools.browser_tools import BrowserResult, BrowserSession, BrowserTools
from .tools.journey_tools import JourneyTools
from src.journeys.models import JourneyResult

ToolHandler = Callable[[Dict[str, Any] | None], Awaitable[Any]]


class McpServer:
    def __init__(self) -> None:
        self.tools: Dict[str, ToolHandler] = {}
        self.resources = load_spec_resources()

    def register_tool(self, name: str, handler: ToolHandler) -> None:
        self.tools[name] = handler

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get("method")
        request_id = request.get("id", "unknown")
        params = request.get("params")

        if method == "resources/list":
            return {
                "id": request_id,
                "result": [
                    {"id": res.id, "name": res.name, "mimeType": res.mime_type, "path": res.path}
                    for res in self.resources
                ],
            }

        if method == "resources/get":
            resource_id = (params or {}).get("id")
            match = next((res for res in self.resources if res.id == resource_id), None)
            if match is None:
                return {"id": request_id, "error": {"message": f"Resource not found: {resource_id}"}}
            return {"id": request_id, "result": match.__dict__}

        handler = self.tools.get(method)
        if handler is None:
            return {"id": request_id, "error": {"message": f"Unknown method: {method}"}}

        try:
            result = await handler(params)
            return {"id": request_id, "result": _normalize_result(result)}
        except Exception as exc:  # pylint: disable=broad-except
            return {"id": request_id, "error": {"message": str(exc)}}


async def main() -> None:
    session = BrowserSession()
    browser_tools = BrowserTools(session)
    journey_tools = JourneyTools(session)
    server = McpServer()

    server.register_tool("browser.navigate", lambda params: browser_tools.browser_navigate(url=_require(params, "url")))
    server.register_tool("browser.click", lambda params: browser_tools.browser_click(selector=_require(params, "selector")))
    server.register_tool("browser.fill", lambda params: browser_tools.browser_fill(selector=_require(params, "selector"), value=_require(params, "value")))
    server.register_tool("browser.getText", lambda params: browser_tools.browser_get_text(selector=_require(params, "selector")))
    server.register_tool("browser.screenshot", lambda params: browser_tools.browser_screenshot(path=params.get("path") if params else None))
    server.register_tool("test.runJourney", lambda params: journey_tools.run_journey(journey_id=_require(params, "journeyId"), user=params.get("user") if params else None))

    print("MCP server ready. Send JSON-RPC lines to stdin.", flush=True)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        while not stop_event.is_set():
            line = await _readline()
            if line is None:
                break
            if line == "":
                continue

            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:  # type: ignore[attr-defined]
                sys.stdout.write(json.dumps({"id": "unknown", "error": {"message": f"Invalid JSON: {exc}"}}) + "\n")
                sys.stdout.flush()
                continue

            response = await server.handle_request(payload)
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
    finally:
        await session.close()


def _require(params: Dict[str, Any] | None, key: str) -> Any:
    if params is None or key not in params:
        raise ValueError(f"Missing required param: {key}")
    return params[key]


def _normalize_result(value: Any) -> Any:
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    if isinstance(value, JourneyResult):
        return value.model_dump()
    if isinstance(value, BrowserResult):
        return dataclasses.asdict(value)
    return value


async def _readline() -> str | None:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_readline)


def _sync_readline() -> str | None:
    line = sys.stdin.readline()
    return line.strip() if line else None


if __name__ == "__main__":
    asyncio.run(main())
