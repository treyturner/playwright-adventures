import re

from playwright.async_api import Page, expect

from ..config import get_base_url
from ..journeys.models import TestUser


class LoginPage:
    def __init__(self, page: Page) -> None:
        self.page = page

    async def goto(self) -> None:
        await self.page.goto(f"{get_base_url()}/login")
        await expect(
            self.page.get_by_role("heading", level=1, name=re.compile(r"sign in|log in", re.IGNORECASE))
        ).to_be_visible()

    async def fill_form(self, user: TestUser) -> None:
        await self.page.get_by_label(re.compile("email", re.IGNORECASE)).fill(user.email)
        await self.page.get_by_label(re.compile("password", re.IGNORECASE)).fill(user.password)

    async def submit(self) -> None:
        await self.page.get_by_role("button", name=re.compile(r"sign in|log in", re.IGNORECASE)).click()
