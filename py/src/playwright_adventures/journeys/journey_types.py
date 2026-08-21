from typing import Literal, TypedDict


class TextMatcher(TypedDict):
    values: list[str]
    ignoreCase: bool
    exact: bool


class RoleSelector(TypedDict):
    first: bool
    by: Literal["role"]
    role: Literal["button", "heading", "link"]
    name: TextMatcher | None
    level: int | None


class LabelSelector(TypedDict):
    first: bool
    by: Literal["label"]
    name: TextMatcher


class TestIdSelector(TypedDict):
    first: bool
    by: Literal["testId"]
    value: str


SelectorSpec = RoleSelector | LabelSelector | TestIdSelector
FixtureValue = Literal["user.email", "user.password", "user.displayName"]


class NavigateStep(TypedDict):
    action: Literal["navigate"]
    path: str


class ClickStep(TypedDict):
    action: Literal["click"]
    selector: SelectorSpec


class FillStep(TypedDict):
    action: Literal["fill"]
    selector: SelectorSpec
    value: FixtureValue


class AssertVisibleStep(TypedDict):
    action: Literal["assert-visible"]
    selector: SelectorSpec


JourneyStep = NavigateStep | ClickStep | FillStep | AssertVisibleStep


class JourneySpec(TypedDict):
    id: str
    name: str
    description: str
    successMessage: str
    extends: str | None
    preconditions: list[str]
    steps: list[JourneyStep]
