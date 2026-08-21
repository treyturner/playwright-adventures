from pytest import MonkeyPatch

from playwright_adventures.journeys.journey_runner import _navigation_url, _text_matcher


def test_treats_regex_syntax_in_matcher_values_as_literal_text() -> None:
    matcher = _text_matcher(
        {
            "values": ["(?<word>foo)", "account.total"],
            "ignoreCase": False,
            "exact": True,
        }
    )

    assert matcher.search("(?<word>foo)") is not None
    assert matcher.search("account.total") is not None
    assert matcher.search("foo") is None
    assert matcher.search("account-total") is None


def test_supports_case_insensitive_substring_alternatives() -> None:
    matcher = _text_matcher(
        {
            "values": ["sign in", "log in"],
            "ignoreCase": True,
            "exact": False,
        }
    )

    assert matcher.search("Continue to SIGN IN now") is not None
    assert matcher.search("Log out") is None


def test_resolves_navigation_paths_relative_to_the_application_origin(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("BASE_URL", "https://example.test/application/root")

    assert _navigation_url("/dashboard?tab=accounts") == "https://example.test/dashboard?tab=accounts"
