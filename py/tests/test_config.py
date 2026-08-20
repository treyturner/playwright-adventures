from playwright_adventures.config import normalize_base_url


def test_normalize_base_url_removes_trailing_slashes() -> None:
    assert normalize_base_url("https://example.test/app///") == "https://example.test/app"


def test_normalize_base_url_preserves_an_already_normalized_url() -> None:
    assert normalize_base_url("https://example.test/app") == "https://example.test/app"
