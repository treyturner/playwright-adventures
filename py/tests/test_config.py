import pytest

from playwright_adventures.config import get_base_url, normalize_base_url


def test_normalize_base_url_removes_trailing_slashes() -> None:
    assert normalize_base_url("https://example.test/app///") == "https://example.test/app"


def test_normalize_base_url_preserves_an_already_normalized_url() -> None:
    assert normalize_base_url("https://example.test/app") == "https://example.test/app"


def test_get_base_url_reads_the_current_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BASE_URL", "http://127.0.0.1:43123/")

    assert get_base_url() == "http://127.0.0.1:43123"
