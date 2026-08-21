from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest
from mcp import Client
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.shared.exceptions import MCPError
from mcp.types import LATEST_PROTOCOL_VERSION, TextResourceContents

from playwright_adventures.journeys.generated_specs import JOURNEY_IDS
from playwright_adventures.journeys.models import JourneyResult
from playwright_adventures.journeys.models import TestUser as JourneyUser
from playwright_adventures.mcp_server.main import create_mcp_server, spec_resource_uri
from playwright_adventures.mcp_server.tools.browser_tools import BrowserResult


class StubBrowserTools:
    async def browser_navigate(self, url: str) -> BrowserResult:
        return BrowserResult(success=True, message="Navigated", url=url)

    async def browser_click(self, selector: str) -> BrowserResult:
        return BrowserResult(success=True, message=f"Clicked {selector}")

    async def browser_fill(self, selector: str, value: str) -> BrowserResult:
        return BrowserResult(success=True, message=f"Filled {selector}")

    async def browser_get_text(self, selector: str) -> BrowserResult:
        return BrowserResult(success=True, message="Text retrieved", value="stub text")

    async def browser_screenshot(self, path: str | None = None) -> BrowserResult:
        return BrowserResult(success=True, message="Screenshot captured", screenshot_path=path or "/tmp/stub.png")


class StubJourneyTools:
    async def run_journey(self, journey_id: str, user: JourneyUser | None = None) -> JourneyResult:
        return JourneyResult(journey_id=journey_id, success=True, details="Stub journey completed")


async def test_exposes_tools_and_resources_through_the_mcp_protocol() -> None:
    server = create_mcp_server(StubBrowserTools(), StubJourneyTools())

    async with Client(server) as client:
        assert client.server_info is not None
        assert client.server_info.name == "playwright-adventures-py"

        tools = await client.list_tools()
        assert sorted(tool.name for tool in tools.tools) == [
            "browser.click",
            "browser.fill",
            "browser.getText",
            "browser.navigate",
            "browser.screenshot",
            "test.runJourney",
        ]
        journey_tool = next(tool for tool in tools.tools if tool.name == "test.runJourney")
        assert journey_tool.input_schema["properties"]["journeyId"]["enum"] == list(JOURNEY_IDS)

        navigation = await client.call_tool("browser.navigate", {"url": "https://example.test"})
        assert navigation.is_error is not True
        assert navigation.structured_content == {
            "success": True,
            "message": "Navigated",
            "url": "https://example.test",
            "value": None,
            "screenshot_path": None,
        }

        invalid_selector = await client.call_tool("browser.click", {"selector": "   "})
        assert invalid_selector.is_error is True

        invalid_journey = await client.call_tool("test.runJourney", {"journeyId": "unknown-journey"})
        assert invalid_journey.is_error is True

        with pytest.raises(MCPError, match="Unknown argument.*unexpected"):
            await client.call_tool("browser.click", {"selector": "button", "unexpected": True})

        invalid_user = await client.call_tool(
            "test.runJourney",
            {
                "journeyId": "view-account-details",
                "user": {"email": "test@example.test", "password": "secret", "unexpected": True},
            },
        )
        assert invalid_user.is_error is True

        resources = await client.list_resources()
        assert len(resources.resources) == 3
        assert any(str(resource.uri) == spec_resource_uri("journeys") for resource in resources.resources)

        selectors = await client.read_resource(spec_resource_uri("selectors"))
        content = selectors.contents[0]
        assert isinstance(content, TextResourceContents)
        assert "Selector Policy" in content.text


async def test_serves_the_current_mcp_protocol_over_clean_stdio() -> None:
    project_dir = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as stderr:
        transport = stdio_client(
            StdioServerParameters(
                command=sys.executable,
                args=["-m", "playwright_adventures.mcp_server"],
                cwd=project_dir,
            ),
            errlog=stderr,
        )

        try:
            async with Client(transport, mode="auto") as client:
                assert client.protocol_version == LATEST_PROTOCOL_VERSION
                assert client.server_info is not None
                assert client.server_info.name == "playwright-adventures-py"
                assert len((await client.list_tools()).tools) == 6
                assert len((await client.list_resources()).resources) == 3
        except Exception as error:
            stderr.seek(0)
            raise AssertionError(f"stdio MCP server failed:\n{stderr.read()}") from error
