"""In-memory audience feed. Raw secrets are never stored."""

from __future__ import annotations

import json
import re
import threading
from typing import Callable

try:
    from .redact import ScrubResult, scrub
except ImportError:  # unit tests import this file as a top-level module
    from redact import ScrubResult, scrub

DEFAULT_URL = "http://127.0.0.1:8765/"
URL_RE = re.compile(r"^http://127\.0\.0\.1:\d{1,5}/$")
_REASONS = frozenset({"", "uncertain_secret", "redactor_error", "server_error"})
_MODES = frozenset({"on", "off", "hold"})
_MAX_STRING = 20000
_MAX_STEPS = 5

HostRedactor = Callable[[str], str]


def parse_onair(raw: str) -> str | None:
    parts = (raw or "").strip().lower().split()
    if len(parts) != 1 or parts[0] not in {"on", "off", "hold"}:
        return None
    return parts[0]


def overlay_url(port: int) -> str:
    return f"http://127.0.0.1:{int(port)}/"


def clip(text: str, limit: int) -> str:
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 1].rstrip() + "…"


def status_event(view: dict) -> dict:
    """Desktop chip payload. Mode and loopback URL only — never session text."""
    mode = view.get("mode")
    if mode not in _MODES:
        mode = "hold"
    url = view.get("url")
    if not isinstance(url, str) or not URL_RE.match(url):
        url = DEFAULT_URL
    return {"mode": mode, "url": url}


def _too_big(value: object, depth: int = 0) -> bool:
    if depth > 6:
        return True
    if isinstance(value, str):
        return len(value) > _MAX_STRING
    if isinstance(value, dict):
        return any(_too_big(key, depth + 1) or _too_big(item, depth + 1) for key, item in value.items())
    if isinstance(value, (list, tuple)):
        return any(_too_big(item, depth + 1) for item in value)
    return False


def _flat(value: object) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    try:
        return json.dumps(value, ensure_ascii=True, default=str, separators=(",", ":"))
    except (TypeError, ValueError):
        return str(value)


def format_args(args: object) -> str:
    if isinstance(args, str):
        stripped = args.strip()
        if stripped[:1] in "{[":
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, (dict, list)):
                return format_args(parsed)
        return args
    if isinstance(args, dict):
        parts: list[str] = []
        for index, (key, value) in enumerate(args.items()):
            if index >= 6:
                parts.append("…")
                break
            parts.append(f"{key}={_flat(value)}")
        return ", ".join(parts)
    if isinstance(args, (list, tuple)):
        parts = [_flat(item) for item in list(args)[:6]]
        if len(args) > 6:
            parts.append("…")
        return ", ".join(parts)
    if args is None:
        return ""
    return str(args)


def summarize_args(args: object, host: HostRedactor | None = None) -> ScrubResult:
    if _too_big(args):
        return ScrubResult.hold("uncertain_secret")
    result = scrub(format_args(args), host=host)
    if not result.confident:
        return result
    return ScrubResult(clip(result.text, 160), True, "")


def present(view: dict, host: HostRedactor | None = None) -> dict:
    """Last gate before HTML or SSE. Non-on modes and uncertain text publish nothing."""
    mode = view.get("mode")
    if mode not in _MODES:
        mode = "hold"
    url = view.get("url") if isinstance(view.get("url"), str) and URL_RE.match(view["url"]) else DEFAULT_URL
    reason = view.get("hold_reason") if view.get("hold_reason") in _REASONS else ""
    blank = {
        "mode": "hold" if mode not in _MODES else mode,
        "hold_reason": reason if mode == "hold" else "",
        "url": url,
        "ask": "",
        "tool": "",
        "args": "",
        "approval": None,
        "steps": [],
    }
    if mode != "on":
        blank["mode"] = mode
        return blank

    ask = scrub(str(view.get("ask") or ""), host=host)
    tool = scrub(str(view.get("tool") or ""), host=host)
    args = scrub(str(view.get("args") or ""), host=host)
    approval_in = view.get("approval")
    approval_out = None
    if isinstance(approval_in, dict):
        command = scrub(str(approval_in.get("command") or ""), host=host)
        description = scrub(str(approval_in.get("description") or ""), host=host)
        if not command.confident or not description.confident:
            return {**blank, "mode": "hold", "hold_reason": "uncertain_secret"}
        if command.text or description.text:
            approval_out = {
                "command": clip(command.text, 180),
                "description": clip(description.text, 180),
            }
    steps_out = []
    for step in view.get("steps") or []:
        if not isinstance(step, dict):
            return {**blank, "mode": "hold", "hold_reason": "uncertain_secret"}
        step_tool = scrub(str(step.get("tool") or ""), host=host)
        step_args = scrub(str(step.get("args") or ""), host=host)
        if not step_tool.confident or not step_args.confident:
            return {**blank, "mode": "hold", "hold_reason": "uncertain_secret"}
        steps_out.append({"tool": clip(step_tool.text, 64), "args": clip(step_args.text, 160)})
        if len(steps_out) >= _MAX_STEPS:
            break
    if not (ask.confident and tool.confident and args.confident):
        return {**blank, "mode": "hold", "hold_reason": ask.reason or tool.reason or args.reason or "uncertain_secret"}
    return {
        "mode": "on",
        "hold_reason": "",
        "url": url,
        "ask": clip(ask.text, 280),
        "tool": clip(tool.text, 64),
        "args": clip(args.text, 160),
        "approval": approval_out,
        "steps": steps_out,
    }


class Feed:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._version = 0
        self.user_mode = "off"
        self.safety_hold = False
        self.hold_reason = ""
        self.ask = ""
        self.tool = ""
        self.args = ""
        self.approval: dict | None = None
        self.steps: list[dict] = []
        self.url = DEFAULT_URL
        self._host: HostRedactor | None = None

    def set_host_redactor(self, host: HostRedactor | None) -> None:
        with self._lock:
            self._host = host

    def set_url(self, url: str) -> None:
        if not URL_RE.match(url or ""):
            return

        def apply() -> None:
            self.url = url

        self._commit(apply)

    def set_user_mode(self, mode: str) -> None:
        if mode not in {"on", "off", "hold"}:
            return

        def apply() -> None:
            self.user_mode = mode
            if mode in {"off", "hold"}:
                self.safety_hold = False
                self.hold_reason = ""
                self._clear_content()

        self._commit(apply)

    def note_user_ask(self, text: object) -> None:
        result = scrub(text if isinstance(text, str) else "", host=self._host_copy())
        if not isinstance(text, str):
            result = ScrubResult.hold("uncertain_secret")

        def apply() -> None:
            if not result.confident:
                self._latch(result.reason)
                return
            self.safety_hold = False
            self.hold_reason = ""
            self.ask = clip(result.text, 280)
            self.tool = ""
            self.args = ""
            self.approval = None
            self.steps = []

        self._commit(apply)

    def note_tool(self, name: object, args: object) -> None:
        self._remember_tool(name, args, record_step=False)

    def note_step(self, name: object, args: object) -> None:
        self._remember_tool(name, args, record_step=True)

    def note_approval(self, command: object, description: object) -> None:
        host = self._host_copy()
        command_r = scrub(command if isinstance(command, str) else "", host=host)
        description_r = scrub(description if isinstance(description, str) else "", host=host)
        if not isinstance(command, str) or not isinstance(description, str):
            command_r = ScrubResult.hold("uncertain_secret")

        def apply() -> None:
            if self.safety_hold:
                return
            if not command_r.confident or not description_r.confident:
                self._latch(command_r.reason or description_r.reason)
                return
            self.approval = {
                "command": clip(command_r.text, 180),
                "description": clip(description_r.text, 180),
            }

        self._commit(apply)

    def clear_approval(self) -> None:
        def apply() -> None:
            if self.safety_hold:
                return
            self.approval = None

        self._commit(apply)

    def end_session(self) -> None:
        def apply() -> None:
            self.safety_hold = False
            self.hold_reason = ""
            self._clear_content()

        self._commit(apply)

    def force_hold(self, reason: str) -> None:
        def apply() -> None:
            self._latch(reason)

        self._commit(apply)

    def public_view(self) -> dict:
        with self._lock:
            return present(self._view_unlocked(), host=self._host)

    def wait_for_change(self, version: int, timeout: float) -> tuple[int, dict, bool]:
        with self._lock:
            if self._version == version:
                self._cond.wait(timeout)
            changed = self._version != version
            view = present(self._view_unlocked(), host=self._host)
            return self._version, view, changed

    def _remember_tool(self, name: object, args: object, *, record_step: bool) -> None:
        host = self._host_copy()
        if not isinstance(name, str):
            name_r = ScrubResult.hold("uncertain_secret")
        else:
            name_r = scrub(name, host=host)
        args_r = summarize_args(args, host=host)

        def apply() -> None:
            if self.safety_hold:
                return
            if not name_r.confident or not args_r.confident:
                self._latch(name_r.reason or args_r.reason)
                return
            self.tool = clip(name_r.text, 64)
            self.args = args_r.text
            if record_step:
                self.steps.append({"tool": self.tool, "args": self.args})
                if len(self.steps) > _MAX_STEPS:
                    del self.steps[: len(self.steps) - _MAX_STEPS]

        self._commit(apply)

    def _host_copy(self) -> HostRedactor | None:
        with self._lock:
            return self._host

    def _clear_content(self) -> None:
        self.ask = ""
        self.tool = ""
        self.args = ""
        self.approval = None
        self.steps = []

    def _latch(self, reason: str) -> None:
        if reason not in {"uncertain_secret", "redactor_error", "server_error"}:
            reason = "uncertain_secret"
        self.safety_hold = True
        self.hold_reason = reason
        self._clear_content()

    def _view_unlocked(self) -> dict:
        mode = "hold" if self.safety_hold else self.user_mode
        if mode not in _MODES:
            mode = "hold"
        view = {
            "mode": mode,
            "hold_reason": self.hold_reason if mode == "hold" else "",
            "url": self.url,
            "ask": "",
            "tool": "",
            "args": "",
            "approval": None,
            "steps": [],
        }
        if mode != "on":
            return view
        view["ask"] = self.ask
        view["tool"] = self.tool
        view["args"] = self.args
        view["approval"] = None if self.approval is None else dict(self.approval)
        view["steps"] = [dict(step) for step in self.steps]
        return view

    def _commit(self, mutate: Callable[[], None]) -> None:
        with self._lock:
            mutate()
            self._version += 1
            view = present(self._view_unlocked(), host=self._host)
            self._cond.notify_all()
        _emit_status(view)


def _emit_status(view: dict) -> None:
    payload = status_event(view)
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event
    except Exception:
        return
    try:
        broadcast_plugin_event("stageglass", "status", payload)
    except Exception:
        return
