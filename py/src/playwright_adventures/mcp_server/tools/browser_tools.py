from __future__ import annotations

import asyncio
from dataclasses import dataclass

from playwright.async_api import Browser, BrowserContext, Page, Playwright, Route, async_playwright

from ..security import BrowserSecurityPolicy


@dataclass
class BrowserResult:
    success: bool
    message: str
    url: str | None = None
    value: str | None = None
    screenshot_path: str | None = None


class BrowserSession:
    def __init__(self, policy: BrowserSecurityPolicy | None = None) -> None:
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._playwright: Playwright | None = None
        self._lock = asyncio.Lock()
        self.policy = policy or BrowserSecurityPolicy.from_environment()

    async def get_page(self) -> Page:
        async with self._lock:
            if self._page:
                return self._page

            playwright = await async_playwright().start()
            self._playwright = playwright
            self._browser = await playwright.chromium.launch(headless=True)
            self._context = await self._browser.new_context(
                accept_downloads=False,
                base_url=self.policy.base_url,
                service_workers="block",
            )
            await self._context.route("**/*", self._guard_navigation)
            self._page = await self._context.new_page()
            return self._page

    async def _guard_navigation(self, route: Route) -> None:
        request = route.request
        if request.is_navigation_request():
            try:
                self.policy.validate_navigation_url(request.url)
            except ValueError:
                await route.abort(error_code="blockedbyclient")
                return
        await route.continue_()

    async def close(self) -> None:
        async with self._lock:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            self._context = None
            self._browser = None
            self._page = None
            self._playwright = None


def _require_non_empty(value: str, label: str) -> None:
    if not value.strip():
        raise ValueError(f"{label} must not be empty")


class BrowserTools:
    def __init__(self, session: BrowserSession) -> None:
        self.session = session

    async def browser_navigate(self, url: str) -> BrowserResult:
        validated_url = self.session.policy.validate_navigation_url(url)
        page = await self.session.get_page()
        await page.goto(validated_url)
        return BrowserResult(success=True, message="Navigated", url=page.url)

    async def browser_click(self, selector: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        await page.click(selector)
        return BrowserResult(success=True, message=f"Clicked {selector}", url=page.url)

    async def browser_fill(self, selector: str, value: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        await page.fill(selector, value)
        return BrowserResult(success=True, message=f"Filled {selector}")

    async def browser_get_text(self, selector: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        content = await page.text_content(selector)
        return BrowserResult(success=True, message="Text retrieved", value=content or "")

    async def browser_screenshot(self, path: str | None = None) -> BrowserResult:
        loop = asyncio.get_running_loop()
        resolved_path = self.session.policy.resolve_screenshot_path(path, int(loop.time() * 1000))
        page = await self.session.get_page()
        await page.screenshot(path=str(resolved_path), full_page=True)
        return BrowserResult(success=True, message="Screenshot captured", screenshot_path=str(resolved_path))
