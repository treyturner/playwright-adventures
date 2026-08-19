from playwright.async_api import Page, expect

from playwright_adventures.config import BASE_URL
from playwright_adventures.pages.home_page import HomePage

EXPECTED_URL = f"{BASE_URL.rstrip('/')}/"


async def test_homepage_renders_heading(page: Page) -> None:
    home = HomePage(page)
    await home.goto()
    await home.expect_hero_heading(r"(?i)welcome")
    await expect(page).to_have_url(EXPECTED_URL)
