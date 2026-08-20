from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import cast

import pytest

from playwright_adventures.mcp_server.security import BrowserSecurityPolicy
from playwright_adventures.mcp_server.tools.browser_tools import BrowserSession, BrowserTools


class _DocumentHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        body = b"<!doctype html><html><body><h1>Allowed document</h1></body></html>"
        self.send_response(200)
        self.send_header("content-type", "text/html")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        pass


@contextmanager
def _document_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _DocumentHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = cast(tuple[str, int], server.server_address)

    try:
        yield f"http://{host}:{port}/"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


SCENARIOS = (
    (
        "blob-main-frame",
        "framenavigated",
        "blob:",
        """() => {
            const documentBlob = new Blob(['<h1>blocked</h1>'], { type: 'text/html' });
            window.location.href = URL.createObjectURL(documentBlob);
        }""",
    ),
    (
        "srcdoc-child-frame",
        "framenavigated",
        "about:srcdoc",
        """() => {
            const frame = document.createElement('iframe');
            frame.srcdoc = '<h1>blocked</h1>';
            document.body.append(frame);
        }""",
    ),
    ("blank-popup", "page", "about:blank", "() => window.open('about:blank', '_blank')"),
)


@pytest.mark.parametrize(("_scenario", "event_name", "expected_url_prefix", "trigger"), SCENARIOS)
async def test_context_navigation_event_catches_networkless_documents_and_closes_context(
    _scenario: str,
    event_name: str,
    expected_url_prefix: str,
    trigger: str,
    tmp_path: Path,
) -> None:
    with _document_server() as base_url:
        policy = BrowserSecurityPolicy.from_environment({"BASE_URL": base_url}, tmp_path)
        session = BrowserSession(policy)

        try:
            page = await session.get_page()
            await page.goto(base_url)
            context = page.context

            async with context.expect_event(
                event_name,
                predicate=lambda document: document.url.startswith(expected_url_prefix),
            ) as navigation_info:
                try:
                    await page.evaluate(f"({trigger})()")
                except Exception:
                    pass
            document = await navigation_info.value

            assert document.url.startswith(expected_url_prefix)
            with pytest.raises(ValueError, match="Document navigation blocked"):
                await session.ensure_document_navigations_allowed()
            assert page.is_closed()
            assert context.pages == []
        finally:
            await session.close()


async def test_screenshot_bytes_match_the_requested_file_extension(tmp_path: Path) -> None:
    with _document_server() as base_url:
        policy = BrowserSecurityPolicy.from_environment(
            {"BASE_URL": base_url, "MCP_SCREENSHOT_DIR": "captures"},
            tmp_path,
        )
        session = BrowserSession(policy)
        tools = BrowserTools(session)

        try:
            await tools.browser_navigate(base_url)
            jpeg_results = [await tools.browser_screenshot(filename) for filename in ("capture.jpg", "capture.jpeg")]
            png_result = await tools.browser_screenshot("capture.png")

            for jpeg_result in jpeg_results:
                assert jpeg_result.screenshot_path is not None
                assert Path(jpeg_result.screenshot_path).read_bytes().startswith(b"\xff\xd8\xff")
            assert png_result.screenshot_path is not None
            assert Path(png_result.screenshot_path).read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
        finally:
            await session.close()
