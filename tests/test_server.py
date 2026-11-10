"""Loopback server tests. Secrets here are fake."""

from __future__ import annotations

import socket
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from feed import Feed  # noqa: E402
from server import LOOPBACK, OverlayServer, assert_loopback  # noqa: E402
from tests.test_redact import FIXTURES  # noqa: E402


class ServerTests(unittest.TestCase):
    def test_refuses_non_loopback(self) -> None:
        with self.assertRaises(RuntimeError):
            assert_loopback("0.0.0.0")
        assert_loopback(LOOPBACK)

    def test_live_page_and_sse_exclude_fixtures(self) -> None:
        feed = Feed()
        feed.set_user_mode("on")
        feed.note_user_ask(" | ".join(FIXTURES))
        server = OverlayServer(feed)
        server.port = 0
        try:
            server.start()
            self.assertTrue(server.url.startswith("http://127.0.0.1:"))
            host = server.url.split("//", 1)[1].split(":", 1)[0]
            self.assertEqual(host, "127.0.0.1")
            port = server.port
            html = _get(port, "/")
            snapshot = _get(port, "/snapshot")
            sse = _read_sse(port)
            blob = html + snapshot + sse
            for secret in FIXTURES:
                self.assertNotIn(secret, blob, secret)
            self.assertNotIn("FAKESTAGEGLASS", blob)
            self.assertIn("ON AIR", html)
            self.assertIn("[REDACTED]", html)
            self.assertIn("event: feed", sse)
        finally:
            server.stop()


def _get(port: int, path: str) -> str:
    sock = socket.create_connection((LOOPBACK, port), timeout=3)
    try:
        sock.sendall(f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n".encode())
        chunks = []
        while True:
            data = sock.recv(65536)
            if not data:
                break
            chunks.append(data)
    finally:
        sock.close()
    raw = b"".join(chunks)
    head, _, body = raw.partition(b"\r\n\r\n")
    self_status = head.split(b"\r\n", 1)[0]
    if b" 200 " not in self_status:
        raise AssertionError(self_status.decode("ascii", "replace"))
    return body.decode("utf-8", "replace")


def _read_sse(port: int) -> str:
    sock = socket.create_connection((LOOPBACK, port), timeout=3)
    sock.settimeout(2)
    try:
        sock.sendall(b"GET /events HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        chunks = []
        while True:
            try:
                data = sock.recv(65536)
            except TimeoutError:
                break
            if not data:
                break
            chunks.append(data)
            if b"\n\n" in b"".join(chunks).split(b"\r\n\r\n", 1)[-1]:
                break
    finally:
        sock.close()
    return b"".join(chunks).decode("utf-8", "replace")


if __name__ == "__main__":
    unittest.main()
