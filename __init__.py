"""Stageglass — a loopback audience feed for one Hermes session."""

from __future__ import annotations

import logging

try:
    from .feed import Feed, overlay_url, parse_onair
    from .server import OverlayServer
except ImportError:  # validation probe and unit tests load this file directly
    from feed import Feed, overlay_url, parse_onair
    from server import OverlayServer

logger = logging.getLogger(__name__)

FEED = Feed()
SERVER = OverlayServer(FEED)


def _port(ctx) -> int:
    try:
        raw = ctx.get_config("port", default=8765)
    except Exception:
        raw = 8765
    try:
        port = int(raw)
    except (TypeError, ValueError):
        return 8765
    if 1024 <= port <= 65535:
        return port
    return 8765


def _host_redactor(ctx):
    fn = getattr(ctx, "redact_text", None)
    if not callable(fn):
        return None

    def _call(text: str) -> str:
        try:
            return fn(text, force=True)
        except TypeError:
            return fn(text)

    return _call


def _ensure_server() -> None:
    try:
        SERVER.start()
    except Exception:
        logger.warning("Stageglass could not bind 127.0.0.1")
        FEED.force_hold("server_error")


def _on_pre_llm(user_message: str = "", **kwargs):
    FEED.note_user_ask(user_message if isinstance(user_message, str) else "")
    _ensure_server()
    return None


def _on_pre_tool(tool_name: str = "", args=None, **kwargs):
    FEED.note_tool(tool_name if isinstance(tool_name, str) else "", args)
    return None


def _on_post_tool(tool_name: str = "", args=None, **kwargs):
    FEED.note_step(tool_name if isinstance(tool_name, str) else "", args)
    return None


def _on_pre_approval(command: str = "", description: str = "", **kwargs):
    FEED.note_approval(
        command if isinstance(command, str) else "",
        description if isinstance(description, str) else "",
    )
    return None


def _on_post_approval(**kwargs):
    FEED.clear_approval()
    return None


def _on_session_start(**kwargs):
    _ensure_server()
    return None


def _on_session_end(**kwargs):
    # This hook also fires at the end of every turn. The last redacted frame
    # stays up so a screen share does not go blank between messages.
    return None


def _on_onair(raw_args: str = "", **kwargs) -> str:
    mode = parse_onair(raw_args if isinstance(raw_args, str) else "")
    if mode is None:
        return f"Usage: /onair on|off|hold\nOverlay: {FEED.url}"
    FEED.set_user_mode(mode)
    _ensure_server()
    shown = FEED.public_view()
    label = {"on": "ON AIR", "hold": "HOLD", "off": "OFF"}.get(shown["mode"], "HOLD")
    return f"Stageglass is {label}. Overlay: {shown['url']}"


def register(ctx) -> None:
    """Register observer hooks and the /onair command. Does not open a socket."""
    FEED.set_host_redactor(_host_redactor(ctx))
    port = _port(ctx)
    SERVER.configure(port)
    FEED.set_url(overlay_url(port))
    ctx.register_hook("pre_llm_call", _on_pre_llm)
    ctx.register_hook("pre_tool_call", _on_pre_tool)
    ctx.register_hook("post_tool_call", _on_post_tool)
    ctx.register_hook("pre_approval_request", _on_pre_approval)
    ctx.register_hook("post_approval_response", _on_post_approval)
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("on_session_end", _on_session_end)
    ctx.register_command(
        "onair",
        handler=_on_onair,
        description="Set the Stageglass audience overlay to on, off, or hold",
        args_hint="on|off|hold",
    )
