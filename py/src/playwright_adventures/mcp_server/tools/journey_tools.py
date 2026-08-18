from __future__ import annotations

from ...journeys import JourneyResult, TestUser, demo_user, login_and_view_dashboard, view_account_details
from .browser_tools import BrowserSession

JOURNEY_MAP = {
    "login-and-view-dashboard": login_and_view_dashboard,
    "view-account-details": view_account_details,
}


class JourneyTools:
    def __init__(self, session: BrowserSession) -> None:
        self.session = session

    async def run_journey(self, journey_id: str, user: TestUser | None = None) -> JourneyResult:
        page = await self.session.get_page()
        journey = JOURNEY_MAP.get(journey_id)
        if journey is None:
            raise ValueError(f"Unknown journey: {journey_id}")

        user_obj = TestUser.model_validate(user) if user is not None else demo_user
        return await journey(page, user_obj)
