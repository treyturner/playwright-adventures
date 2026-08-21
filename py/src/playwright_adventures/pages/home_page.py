import re
from typing import Pattern

from playwright.async_api import Page, expect

from ..config import get_base_url


class HomePage:
    def __init__(self, page: Page) -> None:
        self.page = page

    async def goto(self) -> None:
        await self.page.goto(f"{get_base_url()}/")

    async def expect_hero_heading(self, text: str | Pattern[str]) -> None:
        await expect(self.page.get_by_role("heading", level=1, name=text)).to_be_visible()

    async def open_login(self) -> None:
        await self.page.get_by_role("link", name=re.compile(r"sign in|log in", re.IGNORECASE)).click()
