"""Feed, render, and slash-command tests. Secrets here are fake."""

from __future__ import annotations

import importlib.util
import inspect
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from feed import Feed, parse_onair, present, status_event  # noqa: E402
from server import render_html, render_sse  # noqa: E402
from tests.test_redact import FIXTURES, SEED  # noqa: E402


def _rendered(view: dict) -> str:
    return render_html(view) + "\n" + render_sse(view)


class FeedTests(unittest.TestCase):
    def test_fixtures_never_reach_html_or_sse(self) -> None:
        feed = Feed()
        feed.set_user_mode("on")
        combined = " | ".join(FIXTURES)
        feed.note_user_ask(combined)
        feed.note_step("terminal", {"command": "ls"})
        feed.note_tool("read_file", {"path": combined})
        feed.note_approval(combined, f"run {combined}")
        view = feed.public_view()
        blob = _rendered(view)
        self.assertEqual(view["mode"], "on", view)
        for secret in FIXTURES:
            self.assertNotIn(secret, blob, secret)
        self.assertNotIn("FAKESTAGEGLASS", blob)
        self.assertIn("[REDACTED]", blob)
        self.assertIn("terminal", blob)
        self.assertIn("read_file", blob)

    def test_poisoned_view_is_scrubbed_at_render(self) -> None:
        poisoned = {
            "mode": "on",
            "url": "http://127.0.0.1:8765/",
            "ask": FIXTURES[0],
            "tool": "terminal",
            "args": FIXTURES[1],
            "approval": {"command": FIXTURES[2], "description": "approve"},
            "steps": [{"tool": "terminal", "args": FIXTURES[3]}],
            "hold_reason": "",
        }
        blob = _rendered(poisoned)
        for secret in FIXTURES[:4]:
            self.assertNotIn(secret, blob)

    def test_uncertainty_holds_and_hides_raw(self) -> None:
        feed = Feed()
        feed.set_user_mode("on")
        feed.note_user_ask("List the project files.")
        raw = "-----BEGIN OPENSSH PRIVATE KEY-----\nFAKESTAGEGLASS-NOT-CLOSED"
        feed.note_approval(raw, "write a key file")
        view = feed.public_view()
        blob = _rendered(view)
        self.assertEqual(view["mode"], "hold")
        self.assertEqual(view["ask"], "")
        self.assertIsNone(view["approval"])
        self.assertNotIn("NOT-CLOSED", blob)
        self.assertNotIn("BEGIN OPENSSH", blob)
        self.assertNotIn("List the project files.", blob)
        self.assertIn("nothing from the session is on screen", blob.lower())

    def test_hold_view_drops_planted_secret(self) -> None:
        view = present({
            "mode": "hold",
            "ask": FIXTURES[0],
            "tool": "terminal",
            "args": FIXTURES[1],
            "url": "http://127.0.0.1:8765/",
        })
        blob = _rendered(view)
        self.assertEqual(view["ask"], "")
        self.assertNotIn(FIXTURES[0], blob)
        self.assertNotIn(FIXTURES[1], blob)

    def test_off_shows_nothing(self) -> None:
        feed = Feed()
        feed.note_user_ask("List the project files.")
        view = feed.public_view()
        self.assertEqual(view["mode"], "off")
        self.assertEqual(view["ask"], "")
        self.assertIn("Off air.", render_html(view))
        self.assertNotIn("List the project files.", render_html(view))

    def test_onair_parser(self) -> None:
        self.assertEqual(parse_onair("on"), "on")
        self.assertEqual(parse_onair(" HOLD "), "hold")
        self.assertIsNone(parse_onair("on now"))
        self.assertIsNone(parse_onair(""))

    def test_user_hold_clears_the_screen(self) -> None:
        feed = Feed()
        feed.set_user_mode("on")
        feed.note_user_ask("List the project files.")
        feed.set_user_mode("hold")
        view = feed.public_view()
        self.assertEqual(view["mode"], "hold")
        self.assertEqual(view["ask"], "")

    def test_status_event_has_no_session_text(self) -> None:
        event = status_event({
            "mode": "on",
            "url": "http://127.0.0.1:8765/",
            "ask": FIXTURES[0],
        })
        self.assertEqual(set(event), {"mode", "url"})
        self.assertNotIn("ask", event)
        self.assertNotIn(FIXTURES[0], str(event))

    def test_near_seed_does_not_return_to_air(self) -> None:
        feed = Feed()
        feed.set_user_mode("on")
        feed.note_user_ask(" ".join(SEED.split()[:11]))
        feed.set_user_mode("on")
        view = feed.public_view()
        self.assertEqual(view["mode"], "hold")
        self.assertNotIn("abandon ability", _rendered(view))


class RegisterTests(unittest.TestCase):
    def test_register_matches_manifest_and_does_not_bind(self) -> None:
        spec = importlib.util.spec_from_file_location(
            "stageglass_plugin",
            ROOT / "__init__.py",
            submodule_search_locations=[str(ROOT)],
        )
        module = importlib.util.module_from_spec(spec)
        module.__path__ = [str(ROOT)]
        sys.modules["stageglass_plugin"] = module
        assert spec.loader is not None
        spec.loader.exec_module(module)
        started = []
        module.SERVER.start = lambda: started.append("start") or "http://127.0.0.1:8765/"

        class Ctx:
            def __init__(self) -> None:
                self.hooks = []
                self.commands = []

            def get_config(self, key, default=None):
                return default

            def register_hook(self, name, callback, **kwargs):
                self.hooks.append((name, callback))

            def register_command(self, name, handler, description="", args_hint=""):
                self.commands.append((name, handler, args_hint))

        ctx = Ctx()
        module.register(ctx)
        names = [name for name, _callback in ctx.hooks]
        self.assertEqual(
            names,
            [
                "pre_llm_call",
                "pre_tool_call",
                "post_tool_call",
                "pre_approval_request",
                "post_approval_response",
                "on_session_start",
                "on_session_end",
            ],
        )
        for _name, callback in ctx.hooks:
            self.assertTrue(any(
                param.kind is inspect.Parameter.VAR_KEYWORD
                for param in inspect.signature(callback).parameters.values()
            ))
        self.assertEqual(ctx.commands[0][0], "onair")
        self.assertEqual(started, [])

        pre_llm = ctx.hooks[0][1]
        self.assertIsNone(pre_llm(user_message=f"please use {FIXTURES[0]}"))
        module.FEED.set_user_mode("on")
        blob = _rendered(module.FEED.public_view())
        self.assertNotIn(FIXTURES[0], blob)
        self.assertIn("[REDACTED]", blob)
        reply = ctx.commands[0][1]("hold")
        self.assertIn("HOLD", reply)
        self.assertNotIn(FIXTURES[0], reply)


if __name__ == "__main__":
    unittest.main()
