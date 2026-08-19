from playwright.async_api import Page, expect

from ..pages.home_page import HomePage
from ..pages.login_page import LoginPage
from .models import JourneyResult, TestUser, demo_user


async def login_and_view_dashboard(page: Page, user: TestUser = demo_user) -> JourneyResult:
    home = HomePage(page)
    login = LoginPage(page)

    await home.goto()
    await home.open_login()
    await login.fill_form(user)
    await login.submit()

    await expect(page.get_by_role("heading", level=1, name=r"(?i)dashboard")).to_be_visible()
    await expect(page.get_by_test_id("account-summary")).to_be_visible()
    return JourneyResult(journey_id="login-and-view-dashboard", success=True, details="Dashboard rendered")


async def view_account_details(page: Page, user: TestUser = demo_user) -> JourneyResult:
    await login_and_view_dashboard(page, user)
    await page.get_by_test_id("account-list-item").first.click()
    await expect(page.get_by_role("heading", level=1, name=r"(?i)account details")).to_be_visible()
    await expect(page.get_by_test_id("transaction-table")).to_be_visible()
    return JourneyResult(journey_id="view-account-details", success=True, details="Account details rendered")
