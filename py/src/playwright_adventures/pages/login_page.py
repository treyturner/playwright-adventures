from playwright.async_api import Page, expect

from ..config import BASE_URL
from ..journeys.models import TestUser


class LoginPage:
    def __init__(self, page: Page) -> None:
        self.page = page

    async def goto(self) -> None:
        await self.page.goto(f"{BASE_URL}/login")
        await expect(self.page.get_by_role("heading", level=1, name=r"(?i)sign in|log in")).to_be_visible()

    async def fill_form(self, user: TestUser) -> None:
        await self.page.get_by_label(r"(?i)email").fill(user.email)
        await self.page.get_by_label(r"(?i)password").fill(user.password)

    async def submit(self) -> None:
        await self.page.get_by_role("button", name=r"(?i)sign in|log in").click()
