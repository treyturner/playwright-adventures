from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict, cast

import pytest
from playwright.async_api import Frame, Page

from playwright_adventures.mcp_server.security import BrowserSecurityPolicy
from playwright_adventures.mcp_server.tools.browser_tools import BrowserSession
from playwright_adventures.mcp_server.tools.journey_tools import JourneyBrowserSession, with_isolated_browser_session


class AllowedNavigation(TypedDict):
    input: str
    normalized: str


class SecurityFixture(TypedDict):
    environment: dict[str, str]
    allowedNavigations: list[AllowedNavigation]
    blockedNavigations: list[str]
    validScreenshotFilenames: list[str]
    invalidScreenshotFilenames: list[str]


FIXTURE_PATH = Path(__file__).resolve().parents[3] / "common" / "specs" / "mcp-security.json"
FIXTURE = cast(SecurityFixture, json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))


def test_navigation_policy_allows_configured_origins_and_blocks_unsafe_destinations(tmp_path: Path) -> None:
    policy = BrowserSecurityPolicy.from_environment(FIXTURE["environment"], tmp_path)

    for navigation in FIXTURE["allowedNavigations"]:
        assert policy.validate_navigation_url(navigation["input"]) == navigation["normalized"]
    for blocked_navigation in FIXTURE["blockedNavigations"]:
        with pytest.raises(ValueError):
            policy.validate_navigation_url(blocked_navigation)
    with pytest.raises(ValueError, match="scheme, host, and optional port"):
        BrowserSecurityPolicy.from_environment(
            {
                "BASE_URL": "https://app.example.test",
                "MCP_ALLOWED_ORIGINS": "https://app.example.test/path",
            },
            tmp_path,
        )


async def test_document_navigation_guard_records_a_networkless_document_violation(tmp_path: Path) -> None:
    policy = BrowserSecurityPolicy.from_environment({"BASE_URL": "https://app.example.test"}, tmp_path)
    session = BrowserSession(policy)

    class StubFrame:
        url = "about:blank"
        page = cast(Page, object())

    frame = StubFrame()
    session._guard_document_navigation(cast(Frame, frame))

    with pytest.raises(ValueError, match="about:blank"):
        await session.ensure_document_navigations_allowed()
    await session.close()


def test_screenshot_paths_remain_confined_and_are_created_exclusively(tmp_path: Path) -> None:
    policy = BrowserSecurityPolicy.from_environment(
        {"BASE_URL": "https://app.example.test", "MCP_SCREENSHOT_DIR": "captures"},
        tmp_path,
    )

    for filename in FIXTURE["validScreenshotFilenames"]:
        assert policy.resolve_screenshot_path(filename, 1234) == tmp_path / "captures" / filename
    assert policy.resolve_screenshot_path(None, 1234) == tmp_path / "captures" / "shot-1234.png"
    for unsafe_path in FIXTURE["invalidScreenshotFilenames"]:
        with pytest.raises(ValueError):
            policy.resolve_screenshot_path(unsafe_path, 1234)

    first_target = policy.write_screenshot_file("account.png", b"image")
    assert first_target == tmp_path / "captures" / "account.png"
    assert first_target.read_bytes() == b"image"
    with pytest.raises(ValueError, match="already exists"):
        policy.write_screenshot_file("account.png", b"replacement")

    outside_target = tmp_path / "outside.png"
    outside_target.write_text("outside", encoding="utf-8")
    linked_target = policy.screenshot_dir / "linked.png"
    linked_target.symlink_to(outside_target)
    with pytest.raises(ValueError, match="already exists"):
        policy.write_screenshot_file("linked.png", b"replacement")
    assert outside_target.read_text(encoding="utf-8") == "outside"

    dangling_link = policy.screenshot_dir / "dangling.png"
    dangling_link.symlink_to(tmp_path / "missing.png")
    with pytest.raises(ValueError, match="already exists"):
        policy.write_screenshot_file("dangling.png", b"image")


async def test_isolated_browser_sessions_close_after_success_and_failure() -> None:
    close_count = 0

    class StubSession:
        async def get_page(self) -> Page:
            raise AssertionError("not used")

        async def close(self) -> None:
            nonlocal close_count
            close_count += 1

    async def succeed(_session: JourneyBrowserSession) -> str:
        return "done"

    async def fail(_session: JourneyBrowserSession) -> str:
        raise RuntimeError("journey failed")

    assert await with_isolated_browser_session(StubSession, succeed) == "done"
    with pytest.raises(RuntimeError, match="journey failed"):
        await with_isolated_browser_session(StubSession, fail)
    assert close_count == 2
