from playwright.async_api import Page
from playwright_adventures.journeys.account_journeys import view_account_details
from playwright_adventures.journeys.models import demo_user


async def test_view_account_details(page: Page) -> None:
    await view_account_details(page, demo_user)
