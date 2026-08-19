from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from playwright.async_api import Browser, Page, Playwright, async_playwright

from ...config import BASE_URL


@dataclass
class BrowserResult:
    success: bool
    message: str
    url: str | None = None
    value: str | None = None
    screenshot_path: str | None = None


class BrowserSession:
    def __init__(self) -> None:
        self._browser: Browser | None = None
        self._page: Page | None = None
        self._playwright: Playwright | None = None
        self._lock = asyncio.Lock()

    async def get_page(self) -> Page:
        async with self._lock:
            if self._page:
                return self._page

            playwright = await async_playwright().start()
            self._playwright = playwright
            self._browser = await playwright.chromium.launch(headless=True)
            context = await self._browser.new_context(base_url=BASE_URL)
            self._page = await context.new_page()
            return self._page

    async def close(self) -> None:
        async with self._lock:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            self._browser = None
            self._page = None
            self._playwright = None


def ensure_dir(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)


class BrowserTools:
    def __init__(self, session: BrowserSession) -> None:
        self.session = session

    async def browser_navigate(self, url: str) -> BrowserResult:
        page = await self.session.get_page()
        await page.goto(url)
        return BrowserResult(success=True, message="Navigated", url=page.url)

    async def browser_click(self, selector: str) -> BrowserResult:
        page = await self.session.get_page()
        await page.click(selector)
        return BrowserResult(success=True, message=f"Clicked {selector}", url=page.url)

    async def browser_fill(self, selector: str, value: str) -> BrowserResult:
        page = await self.session.get_page()
        await page.fill(selector, value)
        return BrowserResult(success=True, message=f"Filled {selector}")

    async def browser_get_text(self, selector: str) -> BrowserResult:
        page = await self.session.get_page()
        content = await page.text_content(selector)
        return BrowserResult(success=True, message="Text retrieved", value=content or "")

    async def browser_screenshot(self, path: Optional[str] = None) -> BrowserResult:
        page = await self.session.get_page()
        output_dir = Path(os.getcwd()) / "screenshots"
        ensure_dir(output_dir)
        loop = asyncio.get_running_loop()
        resolved_path = Path(path) if path else output_dir / f"shot-{int(loop.time() * 1000)}.png"
        await page.screenshot(path=str(resolved_path), full_page=True)
        return BrowserResult(success=True, message="Screenshot captured", screenshot_path=str(resolved_path))
