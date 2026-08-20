from __future__ import annotations

import asyncio
from dataclasses import dataclass

from playwright.async_api import Browser, BrowserContext, Frame, Page, Playwright, Route, async_playwright

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
        self._bootstrap_page: Page | None = None
        self._playwright: Playwright | None = None
        self._lock = asyncio.Lock()
        self._document_violation: ValueError | None = None
        self._document_guard_tasks: set[asyncio.Task[None]] = set()
        self.policy = policy or BrowserSecurityPolicy.from_environment()

    async def get_page(self) -> Page:
        await self.ensure_document_navigations_allowed()
        async with self._lock:
            await self.ensure_document_navigations_allowed()
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
            self._bootstrap_page = self._page
            self._context.on("framenavigated", self._guard_document_navigation)
            self._context.on("page", lambda opened_page: self._guard_document_navigation(opened_page.main_frame))
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

    def _guard_document_navigation(self, frame: Frame) -> None:
        if frame.page == self._bootstrap_page and frame == self._bootstrap_page.main_frame:
            if frame.url == "about:blank":
                return
            self._bootstrap_page = None

        try:
            self.policy.validate_navigation_url(frame.url)
        except ValueError:
            self._document_violation = self._document_violation or ValueError(
                f"Document navigation blocked: {frame.url} is not allowed"
            )
            if self._context and not self._document_guard_tasks:
                task = asyncio.create_task(self._close_context_for_violation(self._context, self._document_violation))
                self._document_guard_tasks.add(task)
                task.add_done_callback(self._document_guard_tasks.discard)

    async def _close_context_for_violation(self, context: BrowserContext, violation: ValueError) -> None:
        try:
            await context.close(reason=str(violation))
        except Exception:
            try:
                if self._browser:
                    await self._browser.close()
            except Exception:
                pass

    async def ensure_document_navigations_allowed(self) -> None:
        violation = self._document_violation
        if not violation:
            return

        if self._document_guard_tasks:
            await asyncio.gather(*tuple(self._document_guard_tasks))
        raise violation

    async def close(self) -> None:
        async with self._lock:
            try:
                if self._document_guard_tasks:
                    await asyncio.gather(*tuple(self._document_guard_tasks))
                if self._context:
                    await self._context.close()
            finally:
                try:
                    if self._browser:
                        await self._browser.close()
                finally:
                    try:
                        if self._playwright:
                            await self._playwright.stop()
                    finally:
                        self._document_guard_tasks.clear()
                        self._context = None
                        self._browser = None
                        self._page = None
                        self._bootstrap_page = None
                        self._playwright = None
                        self._document_violation = None


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
        await self.session.ensure_document_navigations_allowed()
        return BrowserResult(success=True, message="Navigated", url=page.url)

    async def browser_click(self, selector: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        await page.click(selector)
        await self.session.ensure_document_navigations_allowed()
        return BrowserResult(success=True, message=f"Clicked {selector}", url=page.url)

    async def browser_fill(self, selector: str, value: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        await page.fill(selector, value)
        await self.session.ensure_document_navigations_allowed()
        return BrowserResult(success=True, message=f"Filled {selector}")

    async def browser_get_text(self, selector: str) -> BrowserResult:
        _require_non_empty(selector, "Selector")
        page = await self.session.get_page()
        content = await page.text_content(selector)
        await self.session.ensure_document_navigations_allowed()
        return BrowserResult(success=True, message="Text retrieved", value=content or "")

    async def browser_screenshot(self, path: str | None = None) -> BrowserResult:
        loop = asyncio.get_running_loop()
        resolved_path = self.session.policy.resolve_screenshot_path(path, int(loop.time() * 1000))
        page = await self.session.get_page()
        image = await page.screenshot(full_page=True)
        await self.session.ensure_document_navigations_allowed()
        resolved_path = await asyncio.to_thread(
            self.session.policy.write_screenshot_file,
            resolved_path.name,
            image,
        )
        return BrowserResult(success=True, message="Screenshot captured", screenshot_path=str(resolved_path))
