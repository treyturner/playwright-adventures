from __future__ import annotations

import sys
from collections.abc import Awaitable, Callable
from typing import Annotated, Protocol

from mcp.server import MCPServer
from pydantic import Field

from ..journeys.generated_specs import JourneyId
from ..journeys.models import JourneyResult, TestUser
from .resources.specs_resource import SpecResource, load_spec_resources
from .tools.browser_tools import BrowserResult, BrowserSession, BrowserTools
from .tools.journey_tools import JourneyTools
from .validation import RejectUnknownToolArguments

UrlArgument = Annotated[str, Field(min_length=1, max_length=2048)]
SelectorArgument = Annotated[str, Field(min_length=1, max_length=4096, pattern=r"\S")]
FillValueArgument = Annotated[str, Field(max_length=100_000)]
ScreenshotFilenameArgument = Annotated[
    str,
    Field(min_length=1, max_length=128, pattern=r"(?i)^[^/\\]+\.(?:png|jpe?g)$"),
]

TOOL_ARGUMENTS = {
    "browser.navigate": frozenset({"url"}),
    "browser.click": frozenset({"selector"}),
    "browser.fill": frozenset({"selector", "value"}),
    "browser.getText": frozenset({"selector"}),
    "browser.screenshot": frozenset({"path"}),
    "test.runJourney": frozenset({"journeyId", "user"}),
}


class BrowserToolService(Protocol):
    async def browser_navigate(self, url: str) -> BrowserResult: ...

    async def browser_click(self, selector: str) -> BrowserResult: ...

    async def browser_fill(self, selector: str, value: str) -> BrowserResult: ...

    async def browser_get_text(self, selector: str) -> BrowserResult: ...

    async def browser_screenshot(self, path: str | None = None) -> BrowserResult: ...


class JourneyToolService(Protocol):
    async def run_journey(self, journey_id: str, user: TestUser | None = None) -> JourneyResult: ...


def spec_resource_uri(resource_id: str) -> str:
    return f"playwright-adventures://specs/{resource_id}"


def _spec_reader(content: str) -> Callable[[], Awaitable[str]]:
    async def read_spec() -> str:
        return content

    return read_spec


def create_mcp_server(
    browser_tools: BrowserToolService,
    journey_tools: JourneyToolService,
    resources: list[SpecResource] | None = None,
) -> MCPServer[None]:
    server: MCPServer[None] = MCPServer(
        name="playwright-adventures-py",
        version="0.1.0",
        description="Typed Playwright browser automation and shared journeys",
        middleware=[RejectUnknownToolArguments(TOOL_ARGUMENTS)],
    )

    @server.tool(
        name="browser.navigate",
        title="Navigate browser",
        description="Navigate the managed browser page to an allowed HTTP(S) URL",
        structured_output=True,
    )
    async def browser_navigate(url: UrlArgument) -> BrowserResult:
        return await browser_tools.browser_navigate(url)

    @server.tool(
        name="browser.click",
        title="Click browser element",
        description="Click an element matching a Playwright selector",
        structured_output=True,
    )
    async def browser_click(selector: SelectorArgument) -> BrowserResult:
        return await browser_tools.browser_click(selector)

    @server.tool(
        name="browser.fill",
        title="Fill browser input",
        description="Fill an input matching a Playwright selector",
        structured_output=True,
    )
    async def browser_fill(selector: SelectorArgument, value: FillValueArgument) -> BrowserResult:
        return await browser_tools.browser_fill(selector, value)

    @server.tool(
        name="browser.getText",
        title="Read browser text",
        description="Read text content from an element matching a Playwright selector",
        structured_output=True,
    )
    async def browser_get_text(selector: SelectorArgument) -> BrowserResult:
        return await browser_tools.browser_get_text(selector)

    @server.tool(
        name="browser.screenshot",
        title="Capture browser screenshot",
        description="Capture a full-page screenshot inside MCP_SCREENSHOT_DIR",
        structured_output=True,
    )
    async def browser_screenshot(path: ScreenshotFilenameArgument | None = None) -> BrowserResult:
        return await browser_tools.browser_screenshot(path)

    @server.tool(
        name="test.runJourney",
        title="Run browser journey",
        description="Run one of the predefined browser journeys",
        structured_output=True,
    )
    async def test_run_journey(journeyId: JourneyId, user: TestUser | None = None) -> JourneyResult:
        return await journey_tools.run_journey(journeyId, user)

    for resource in resources if resources is not None else load_spec_resources():
        server.resource(
            spec_resource_uri(resource.id),
            name=resource.id,
            title=resource.name,
            description=f"Shared Playwright specification: {resource.name}",
            mime_type=resource.mime_type,
        )(_spec_reader(resource.content))

    return server


async def main() -> None:
    session = BrowserSession()
    server = create_mcp_server(BrowserTools(session), JourneyTools())
    print("Playwright Adventures MCP server running on stdio", file=sys.stderr, flush=True)

    try:
        await server.run_stdio_async()
    finally:
        await session.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
