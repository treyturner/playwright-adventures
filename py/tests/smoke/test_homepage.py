import re

from playwright.async_api import Page, expect

from playwright_adventures.config import get_base_url
from playwright_adventures.pages.home_page import HomePage


async def test_homepage_renders_heading(page: Page) -> None:
    home = HomePage(page)
    await home.goto()
    await home.expect_hero_heading(re.compile("welcome", re.IGNORECASE))
    await expect(page).to_have_url(f"{get_base_url()}/")
