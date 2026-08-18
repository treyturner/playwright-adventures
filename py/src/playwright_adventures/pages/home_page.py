from typing import Pattern

from playwright.async_api import Page, expect
from ..config import BASE_URL


class HomePage:
    def __init__(self, page: Page) -> None:
        self.page = page

    async def goto(self) -> None:
        await self.page.goto(f"{BASE_URL}/")

    async def expect_hero_heading(self, text: str | Pattern[str]) -> None:
        await expect(self.page.get_by_role("heading", level=1, name=text)).to_be_visible()

    async def open_login(self) -> None:
        await self.page.get_by_role("link", name=r"(?i)sign in|log in").click()
