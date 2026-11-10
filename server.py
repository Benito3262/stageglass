"""Loopback-only overlay. The listen address is fixed to 127.0.0.1."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

try:
    from .feed import DEFAULT_URL, present
except ImportError:
    from feed import DEFAULT_URL, present

LOOPBACK = "127.0.0.1"
STATIC_DIR = Path(__file__).resolve().parent / "static"
_SENTENCES = {
    "off": "Off air.",
    "hold": {
        "": "Feed held. Nothing from the session is on screen.",
        "uncertain_secret": "Feed held. Redaction was not sure, so nothing from the session is on screen.",
        "redactor_error": "Feed held. Redaction failed closed, so nothing from the session is on screen.",
        "server_error": "Feed held. The overlay is not available, so nothing from the session is on screen.",
    },
}


def assert_loopback(host: str) -> None:
    if host != LOOPBACK:
        raise RuntimeError("Stageglass only binds the loopback address")


def render_json(view: dict) -> str:
    safe = present(view)
    return json.dumps(safe, ensure_ascii=True, separators=(",", ":")).replace("<", "\\u003c")


def render_sse(view: dict) -> str:
    return f"event: feed\ndata: {render_json(view)}\n\n"


def render_html(view: dict) -> str:
    safe = present(view)
    mode = safe["mode"]
    if mode == "on":
        lede = safe["ask"] or "Waiting for the next message."
        tool = safe["tool"] or "—"
        args = safe["args"] or "—"
        steps = safe["steps"]
        approval = safe["approval"]
    elif mode == "hold":
        reason = safe.get("hold_reason") or ""
        lede = _SENTENCES["hold"].get(reason, _SENTENCES["hold"][""])
        tool = "—"
        args = "—"
        steps = []
        approval = None
    else:
        lede = _SENTENCES["off"]
        tool = "—"
        args = "—"
        steps = []
        approval = None
    label = {"on": "ON AIR", "hold": "HOLD", "off": "OFF"}.get(mode, "HOLD")
    step_html = "".join(
        "<li><span class=\"step-tool\">"
        + _esc(step.get("tool") or "")
        + "</span><span class=\"step-args\">"
        + _esc(step.get("args") or "")
        + "</span></li>"
        for step in steps
        if isinstance(step, dict)
    )
    if mode == "on" and not step_html:
        step_html = "<li class=\"empty\">No steps yet</li>"
    if approval:
        approval_text = " — ".join(
            part for part in (approval.get("description") or "", approval.get("command") or "") if part
        )
        approval_block = (
            "<section class=\"approval\" id=\"approval\"><span class=\"k\">Approval</span>"
            f"<p id=\"approval-text\">{_esc(approval_text)}</p></section>"
        )
    else:
        approval_block = (
            "<section class=\"approval\" id=\"approval\" hidden><span class=\"k\">Approval</span>"
            "<p id=\"approval-text\"></p></section>"
        )
    live_hidden = "" if mode == "on" else " hidden"
    boot = render_json(safe)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Stageglass</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body data-mode="{_esc(mode)}">
<main class="frame">
  <header>
    <div class="brand"><span class="word">Stageglass</span><span class="sub">Audience feed</span></div>
    <div class="chip" id="chip"><span class="dot" aria-hidden="true"></span><span id="chip-label">{_esc(label)}</span></div>
  </header>
  <p class="lede" id="lede">{_esc(lede)}</p>
  <section class="live"{live_hidden} id="live">
    <div class="grid">
      <div><span class="k">Tool</span><span class="v" id="tool">{_esc(tool)}</span></div>
      <div><span class="k">Arguments</span><span class="v" id="args">{_esc(args)}</span></div>
    </div>
    {approval_block}
    <div class="steps-wrap">
      <span class="k">Recent steps</span>
      <ol id="steps">{step_html}</ol>
    </div>
  </section>
  <footer><span id="url">{_esc(safe["url"])}</span><span>Loopback only</span></footer>
</main>
<script type="application/json" id="boot">{boot}</script>
<script src="/static/app.js"></script>
</body>
</html>
"""


def _esc(value: object) -> str:
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


class _Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def server_bind(self) -> None:
        super().server_bind()
        host = self.socket.getsockname()[0]
        try:
            assert_loopback(str(host))
        except RuntimeError:
            self.server_close()
            raise


class OverlayServer:
    def __init__(self, feed) -> None:
        self.feed = feed
        self.port = 8765
        self.url = DEFAULT_URL
        self._httpd: _Server | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def configure(self, port: int) -> None:
        with self._lock:
            if self._httpd is not None:
                return
            if isinstance(port, int) and 1024 <= port <= 65535:
                self.port = port
                self.url = f"http://{LOOPBACK}:{port}/"

    def start(self) -> str:
        with self._lock:
            if self._httpd is not None:
                return self.url
            handler = _make_handler(self.feed)
            httpd = _Server((LOOPBACK, self.port), handler)
            host, bound = httpd.server_address[:2]
            assert_loopback(str(host))
            self.port = int(bound)
            self.url = f"http://{LOOPBACK}:{self.port}/"
            self.feed.set_url(self.url)
            thread = threading.Thread(target=httpd.serve_forever, name="stageglass", daemon=True)
            thread.start()
            self._httpd = httpd
            self._thread = thread
            return self.url

    def stop(self) -> None:
        with self._lock:
            httpd = self._httpd
            self._httpd = None
            self._thread = None
        if httpd is not None:
            httpd.shutdown()
            httpd.server_close()


def _make_handler(feed):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:  # noqa: N802
            path = urlsplit(self.path).path
            if path in {"/", "/index.html"}:
                self._send(200, "text/html; charset=utf-8", render_html(feed.public_view()).encode("utf-8"))
                return
            if path == "/events":
                self._events()
                return
            if path == "/snapshot":
                body = render_json(feed.public_view()).encode("utf-8")
                self._send(200, "application/json; charset=utf-8", body)
                return
            if path == "/static/style.css":
                self._file("style.css", "text/css; charset=utf-8")
                return
            if path == "/static/app.js":
                self._file("app.js", "text/javascript; charset=utf-8")
                return
            if path == "/favicon.ico":
                self._send(204, "text/plain; charset=utf-8", b"")
                return
            self._send(404, "text/plain; charset=utf-8", b"Not found\n")

        def do_POST(self) -> None:  # noqa: N802
            self._send(405, "text/plain; charset=utf-8", b"Method not allowed\n")

        def _events(self) -> None:
            self.send_response(200)
            self._headers("text/event-stream; charset=utf-8", length=None)
            self.end_headers()
            version = -1
            try:
                while True:
                    version, view, changed = feed.wait_for_change(version, 15)
                    if changed:
                        payload = render_sse(view)
                    else:
                        payload = ": ping\n\n"
                    self.wfile.write(payload.encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError, OSError):
                return

        def _file(self, name: str, content_type: str) -> None:
            path = STATIC_DIR / name
            try:
                body = path.read_bytes()
            except OSError:
                self._send(404, "text/plain; charset=utf-8", b"Not found\n")
                return
            self._send(200, content_type, body)

        def _send(self, status: int, content_type: str, body: bytes) -> None:
            self.send_response(status)
            self._headers(content_type, len(body))
            self.end_headers()
            if body:
                self.wfile.write(body)

        def _headers(self, content_type: str, length: int | None) -> None:
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'none'; style-src 'self'; script-src 'self'; "
                "img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'",
            )
            if length is not None:
                self.send_header("Content-Length", str(length))
            self.send_header("Connection", "close" if length is not None else "keep-alive")

        def log_message(self, fmt: str, *args) -> None:
            return

    return Handler
