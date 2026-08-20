from __future__ import annotations

import os
import socket
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import pytest

FIXTURE_HEALTH_RESPONSE = b"playwright-adventures-fixture"


def _stop_fixture_app(process: subprocess.Popen[str]) -> tuple[str, str]:
    if process.poll() is None:
        process.terminate()
        try:
            return process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    return process.communicate()


def _available_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture(scope="session", autouse=True)
def managed_fixture_app() -> Iterator[None]:
    if os.getenv("BASE_URL", "").strip():
        yield
        return

    repository_root = Path(__file__).resolve().parents[3]
    port = _available_port()
    fixture_app_url = f"http://127.0.0.1:{port}"
    environment = {**os.environ, "FIXTURE_APP_HOST": "127.0.0.1", "FIXTURE_APP_PORT": str(port)}
    os.environ["BASE_URL"] = fixture_app_url
    process: subprocess.Popen[str] | None = None

    try:
        process = subprocess.Popen(
            ["node", str(repository_root / "fixture-app" / "server.mjs")],
            cwd=repository_root,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        deadline = time.monotonic() + 10

        while time.monotonic() < deadline:
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                pytest.fail(f"Managed fixture app exited during startup.\nstdout:\n{stdout}\nstderr:\n{stderr}")
            try:
                with urlopen(f"{fixture_app_url}/healthz", timeout=0.25) as response:
                    if response.status == 200 and response.read() == FIXTURE_HEALTH_RESPONSE:
                        break
            except (TimeoutError, URLError):
                time.sleep(0.05)
        else:
            stdout, stderr = _stop_fixture_app(process)
            process = None
            pytest.fail(f"Managed fixture app did not become ready.\nstdout:\n{stdout}\nstderr:\n{stderr}")

        yield
    finally:
        if process is not None:
            _stop_fixture_app(process)
        os.environ.pop("BASE_URL", None)
