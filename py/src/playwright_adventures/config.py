import os


def normalize_base_url(value: str) -> str:
    return value.rstrip("/")


def get_base_url() -> str:
    return normalize_base_url(os.getenv("BASE_URL", "http://localhost:3000"))


BASE_URL = get_base_url()
