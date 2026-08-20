import os


def normalize_base_url(value: str) -> str:
    return value.rstrip("/")


BASE_URL = normalize_base_url(os.getenv("BASE_URL", "http://localhost:3000"))
