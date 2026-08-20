from __future__ import annotations

from pathlib import Path

import pytest
from playwright.async_api import Page

from playwright_adventures.mcp_server.security import BrowserSecurityPolicy
from playwright_adventures.mcp_server.tools.journey_tools import JourneyBrowserSession, with_isolated_browser_session


def test_navigation_policy_allows_configured_origins_and_blocks_unsafe_destinations(tmp_path: Path) -> None:
    policy = BrowserSecurityPolicy.from_environment(
        {
            "BASE_URL": "https://app.example.test/",
            "MCP_ALLOWED_ORIGINS": "https://app.example.test, https://login.example.test",
        },
        tmp_path,
    )

    assert policy.validate_navigation_url("https://app.example.test/account") == "https://app.example.test/account"
    assert policy.validate_navigation_url("https://login.example.test/start") == "https://login.example.test/start"
    with pytest.raises(ValueError, match=r"origin .* is not allowed"):
        policy.validate_navigation_url("https://outside.example.test")
    with pytest.raises(ValueError, match=r"absolute HTTP\(S\) URL"):
        policy.validate_navigation_url("file:///etc/passwd")
    with pytest.raises(ValueError, match="credentials"):
        policy.validate_navigation_url("https://user:secret@app.example.test")
    with pytest.raises(ValueError, match="scheme, host, and optional port"):
        BrowserSecurityPolicy.from_environment(
            {
                "BASE_URL": "https://app.example.test",
                "MCP_ALLOWED_ORIGINS": "https://app.example.test/path",
            },
            tmp_path,
        )


def test_screenshot_paths_remain_confined_to_the_configured_directory(tmp_path: Path) -> None:
    policy = BrowserSecurityPolicy.from_environment(
        {"BASE_URL": "https://app.example.test", "MCP_SCREENSHOT_DIR": "captures"},
        tmp_path,
    )

    assert policy.resolve_screenshot_path("account.png", 1234) == tmp_path / "captures" / "account.png"
    assert policy.resolve_screenshot_path(None, 1234) == tmp_path / "captures" / "shot-1234.png"
    for unsafe_path in ("../escape.png", "nested/escape.png", "/tmp/escape.png"):
        with pytest.raises(ValueError, match="must be a filename"):
            policy.resolve_screenshot_path(unsafe_path, 1234)
    with pytest.raises(ValueError, match="must end in"):
        policy.resolve_screenshot_path("capture.txt", 1234)

    outside_target = tmp_path / "outside.png"
    outside_target.write_text("outside", encoding="utf-8")
    linked_target = policy.screenshot_dir / "linked.png"
    linked_target.symlink_to(outside_target)
    with pytest.raises(ValueError, match="symbolic link"):
        policy.resolve_screenshot_path("linked.png", 1234)


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
