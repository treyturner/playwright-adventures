from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Protocol, TypeVar

from playwright.async_api import Page

from ...journeys import JourneyResult, TestUser, demo_user, is_journey_id, run_journey
from .browser_tools import BrowserSession

Result = TypeVar("Result")


class JourneyBrowserSession(Protocol):
    async def get_page(self) -> Page: ...

    async def close(self) -> None: ...


JourneyBrowserSessionFactory = Callable[[], JourneyBrowserSession]


async def with_isolated_browser_session(
    create_session: JourneyBrowserSessionFactory,
    operation: Callable[[JourneyBrowserSession], Awaitable[Result]],
) -> Result:
    session = create_session()
    try:
        return await operation(session)
    finally:
        await session.close()


class JourneyTools:
    def __init__(self, create_session: JourneyBrowserSessionFactory = BrowserSession) -> None:
        self.create_session = create_session

    async def run_journey(self, journey_id: str, user: TestUser | None = None) -> JourneyResult:
        if not is_journey_id(journey_id):
            raise ValueError(f"Unknown journey: {journey_id}")

        user_obj = TestUser.model_validate(user) if user is not None else demo_user

        async def run(session: JourneyBrowserSession) -> JourneyResult:
            page = await session.get_page()
            return await run_journey(page, journey_id, user_obj)

        return await with_isolated_browser_session(self.create_session, run)
