import re
from urllib.parse import urljoin

from playwright.async_api import Locator, Page, expect

from ..config import get_base_url
from .generated_specs import JOURNEY_SPECS, JourneyId, is_journey_id
from .journey_types import FixtureValue, SelectorSpec, TextMatcher
from .models import TestUser


def _text_matcher(value: TextMatcher) -> re.Pattern[str]:
    alternatives = "|".join(re.escape(item) for item in value["values"])
    pattern = f"^(?:{alternatives})$" if value["exact"] else f"(?:{alternatives})"
    flags = re.IGNORECASE if value["ignoreCase"] else 0
    return re.compile(pattern, flags)


def _locator(page: Page, selector: SelectorSpec) -> Locator:
    if selector["by"] == "role":
        name = None if selector["name"] is None else _text_matcher(selector["name"])
        if selector["level"] is None:
            locator = page.get_by_role(selector["role"], name=name)
        else:
            locator = page.get_by_role(selector["role"], name=name, level=selector["level"])
    elif selector["by"] == "label":
        locator = page.get_by_label(_text_matcher(selector["name"]))
    else:
        locator = page.get_by_test_id(selector["value"])

    return locator.first if selector["first"] else locator


def _fixture_value(user: TestUser, value: FixtureValue) -> str:
    if value == "user.email":
        return user.email
    if value == "user.password":
        return user.password
    if user.display_name is None:
        raise ValueError("Journey requires user.displayName, but the fixture value is undefined")
    return user.display_name


def _navigation_url(path: str) -> str:
    return urljoin(get_base_url(), path)


async def execute_journey(
    page: Page,
    user: TestUser,
    journey_id: JourneyId,
    active_journey_ids: tuple[JourneyId, ...] = (),
) -> None:
    if journey_id in active_journey_ids:
        raise ValueError(f"Journey inheritance cycle while executing {journey_id}")

    spec = JOURNEY_SPECS[journey_id]
    parent_id = spec["extends"]
    if parent_id is not None:
        if not is_journey_id(parent_id):
            raise ValueError(f"Journey {journey_id} extends unknown journey: {parent_id}")
        await execute_journey(page, user, parent_id, (*active_journey_ids, journey_id))

    for step in spec["steps"]:
        if step["action"] == "navigate":
            await page.goto(_navigation_url(step["path"]))
        elif step["action"] == "click":
            await _locator(page, step["selector"]).click()
        elif step["action"] == "fill":
            await _locator(page, step["selector"]).fill(_fixture_value(user, step["value"]))
        else:
            await expect(_locator(page, step["selector"])).to_be_visible()
