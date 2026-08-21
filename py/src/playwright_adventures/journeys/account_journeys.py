from playwright.async_api import Page

from .generated_specs import JOURNEY_SPECS, JourneyId
from .journey_runner import execute_journey
from .models import JourneyResult, TestUser, demo_user


async def run_journey(page: Page, journey_id: JourneyId, user: TestUser = demo_user) -> JourneyResult:
    await execute_journey(page, user, journey_id)
    return JourneyResult(journey_id=journey_id, success=True, details=JOURNEY_SPECS[journey_id]["successMessage"])


async def login_and_view_dashboard(page: Page, user: TestUser = demo_user) -> JourneyResult:
    return await run_journey(page, "login-and-view-dashboard", user)


async def view_account_details(page: Page, user: TestUser = demo_user) -> JourneyResult:
    return await run_journey(page, "view-account-details", user)
