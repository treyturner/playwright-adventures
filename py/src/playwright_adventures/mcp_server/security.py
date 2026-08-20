from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath

from pydantic import AnyHttpUrl, TypeAdapter, ValidationError

from ..config import BASE_URL

SUPPORTED_SCREENSHOT_EXTENSIONS = {".jpeg", ".jpg", ".png"}
HTTP_URL_ADAPTER = TypeAdapter(AnyHttpUrl)


def _parse_http_url(value: str, label: str) -> AnyHttpUrl:
    if (
        value != value.strip()
        or "\\" in value
        or any(character.isspace() for character in value)
        or not value.lower().startswith(("http://", "https://"))
    ):
        raise ValueError(f"{label} must be an absolute HTTP(S) URL")

    try:
        parsed = HTTP_URL_ADAPTER.validate_python(value)
    except ValidationError as error:
        raise ValueError(f"{label} must be an absolute HTTP(S) URL") from error
    if parsed.username is not None or parsed.password is not None:
        raise ValueError(f"{label} must not contain credentials")
    return parsed


def _parsed_origin(parsed: AnyHttpUrl) -> str:
    default_port = 80 if parsed.scheme == "http" else 443
    port = f":{parsed.port}" if parsed.port is not None and parsed.port != default_port else ""
    return f"{parsed.scheme}://{parsed.host}{port}"


def _allowed_origin(value: str) -> str:
    parsed = _parse_http_url(value, "Allowed origin")
    if parsed.path not in {None, "", "/"} or parsed.query is not None or parsed.fragment is not None:
        raise ValueError("Allowed origin must contain only a scheme, host, and optional port")
    return _parsed_origin(parsed)


@dataclass(frozen=True)
class BrowserSecurityPolicy:
    base_url: str
    allowed_origins: frozenset[str]
    screenshot_dir: Path

    @classmethod
    def from_environment(
        cls,
        environment: Mapping[str, str] | None = None,
        working_directory: Path | None = None,
    ) -> BrowserSecurityPolicy:
        values = os.environ if environment is None else environment
        parsed_base_url = _parse_http_url(values.get("BASE_URL") or BASE_URL or "http://localhost:3000", "BASE_URL")
        base_url = str(parsed_base_url)
        configured_origins = [
            origin.strip() for origin in values.get("MCP_ALLOWED_ORIGINS", "").split(",") if origin.strip()
        ]
        allowed_origins = (
            frozenset(_allowed_origin(origin) for origin in configured_origins)
            if configured_origins
            else frozenset({_parsed_origin(parsed_base_url)})
        )
        screenshot_root = values.get("MCP_SCREENSHOT_DIR") or "screenshots"
        screenshot_dir = ((working_directory or Path.cwd()) / screenshot_root).resolve()
        return cls(base_url=base_url, allowed_origins=allowed_origins, screenshot_dir=screenshot_dir)

    def validate_navigation_url(self, value: str) -> str:
        parsed = _parse_http_url(value, "Navigation URL")
        origin = _parsed_origin(parsed)
        if origin not in self.allowed_origins:
            raise ValueError(f"Navigation blocked: origin {origin} is not allowed")
        return str(parsed)

    def resolve_screenshot_path(self, requested_filename: str | None, timestamp: int) -> Path:
        filename = requested_filename or f"shot-{timestamp}.png"
        if (
            not filename
            or filename in {".", ".."}
            or "/" in filename
            or "\\" in filename
            or "\0" in filename
            or Path(filename).is_absolute()
            or PureWindowsPath(filename).is_absolute()
        ):
            raise ValueError("Screenshot path must be a filename inside MCP_SCREENSHOT_DIR")
        if Path(filename).suffix.lower() not in SUPPORTED_SCREENSHOT_EXTENSIONS:
            raise ValueError("Screenshot filename must end in .png, .jpg, or .jpeg")

        return self.screenshot_dir / filename

    def write_screenshot_file(self, filename: str, data: bytes) -> Path:
        self.resolve_screenshot_path(filename, 0)
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)
        canonical_directory = self.screenshot_dir.resolve(strict=True)
        target = canonical_directory / filename

        try:
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError as error:
            raise ValueError("Screenshot target already exists") from error

        with os.fdopen(descriptor, "wb") as screenshot_file:
            screenshot_file.write(data)
        return target
