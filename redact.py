"""Fail-closed redaction for text that may be shown on the Stageglass overlay.

Known secret shapes are replaced with ``[REDACTED]``. Anything that looks like a
secret but does not match a shape we will stand behind is not returned: the
caller must drop the text and hold the feed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

REDACTED = "[REDACTED]"
SCRUB_MAX = 20000

_WORDLIST = Path(__file__).with_name("bip39_english.txt")
_WORDS: frozenset[str] | None = None
_WORDS_LOADED = False

_SEED_LENGTHS = frozenset({12, 15, 18, 21, 24})

_HOST_SENTINEL = re.compile(r"«redacted:[^»]{0,160}»")

_PEM = re.compile(
    r"-----BEGIN [A-Z0-9 ]{1,48}-----[\s\S]{0,8000}?-----END [A-Z0-9 ]{1,48}-----"
)
_JWT = re.compile(
    r"(?<![A-Za-z0-9_\-])eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{8,}"
)
_PREFIXED = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"(?i:sk-[A-Za-z0-9_\-]{16,}"
    r"|gh[pousr]_[A-Za-z0-9]{16,}"
    r"|github_pat_[A-Za-z0-9_]{16,}"
    r"|xox[a-z]-[A-Za-z0-9\-]{10,})"
    r"|AKIA[0-9A-Z]{16}"
    r"|ASIA[0-9A-Z]{16}"
    r")"
)
_BEARER = re.compile(
    r"(?i)(?<![A-Za-z0-9])bearer\s+[A-Za-z0-9\-._~+/=]{16,}"
)
_AWS_SECRET = re.compile(
    r"(?i)\b(?:aws_)?secret_access_key\s*[=:]\s*['\"]?[A-Za-z0-9/+=]{16,}['\"]?"
)
_ENV = re.compile(
    r"(?i)\b((?:[A-Z][A-Z0-9_]*)?(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|"
    r"PRIVATE_KEY|ACCESS_KEY|CREDENTIAL|AUTH_TOKEN)(?:[A-Z0-9_]*)?)\s*=\s*"
    r"(?:\"[^\"]{0,800}\"|'[^']{0,800}'|\S{1,800})"
)
_EMAIL = re.compile(
    r"(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,253}\.[A-Za-z]{2,24}(?![A-Za-z])"
)
_PHONE = re.compile(
    r"(?<!\w)(?:"
    r"\+\d{1,3}[\s.\-]\(?\d{2,4}\)?[\s.\-]\d{3,4}[\s.\-]\d{3,4}"
    r"|\(\d{3}\)[\s.\-]?\d{3}[\s.\-]\d{4}"
    r"|\d{3}[\s.\-]\d{3}[\s.\-]\d{4}"
    r")(?!\w)"
)
_HEX_KEY = re.compile(r"(?<![A-Za-z0-9])0x[0-9a-fA-F]{64}(?![0-9a-fA-F])")
_SEED_RUN = re.compile(
    r"(?<![A-Za-z])[a-z]{3,8}(?:\s+[a-z]{3,8}){9,}(?![A-Za-z])"
)

_RESIDUAL = re.compile(
    r"-----BEGIN"
    r"|(?<![A-Za-z0-9])(?:"
    r"(?i:sk-[A-Za-z0-9_\-]*"
    r"|gh[pousr]_[A-Za-z0-9]*"
    r"|github_pat_[A-Za-z0-9_]*"
    r"|xox[a-z]-[A-Za-z0-9\-]*)"
    r"|AKIA[0-9A-Z]*"
    r"|ASIA[0-9A-Z]*"
    r"|eyJ[A-Za-z0-9_\-]{8,}"
    r")"
    r"|(?i:(?<![A-Za-z0-9])bearer\s+\S+)"
    r"|(?<![A-Za-z0-9])0x(?:[0-9a-fA-F]{48,63}|[0-9a-fA-F]{65,80})(?![0-9a-fA-F])"
    r"|(?<![A-Za-z0-9])(?<!0x)[0-9a-fA-F]{64}(?![0-9a-fA-F])"
)


@dataclass(frozen=True)
class ScrubResult:
    text: str
    confident: bool
    reason: str = ""

    @classmethod
    def hold(cls, reason: str = "uncertain_secret") -> "ScrubResult":
        if reason not in {"uncertain_secret", "redactor_error"}:
            reason = "uncertain_secret"
        return cls("", False, reason)


def scrub(text: object, host=None) -> ScrubResult:
    """Return redacted text, or an empty non-confident result.

    ``host`` is an optional callable, normally ``ctx.redact_text`` with
    ``force=True`` already bound. It runs first. A failure there, or any
    local pattern we will not stand behind, discards the text.
    """
    if not isinstance(text, str):
        return ScrubResult.hold("uncertain_secret")
    if len(text) > SCRUB_MAX:
        return ScrubResult.hold("uncertain_secret")

    current = text
    if host is not None:
        try:
            hosted = host(current)
        except Exception:
            return ScrubResult.hold("redactor_error")
        if not isinstance(hosted, str) or len(hosted) > SCRUB_MAX:
            return ScrubResult.hold("redactor_error")
        current = _HOST_SENTINEL.sub(REDACTED, hosted)

    current = _PEM.sub(REDACTED, current)
    current = _JWT.sub(REDACTED, current)
    current = _PREFIXED.sub(REDACTED, current)
    current = _BEARER.sub(REDACTED, current)
    current = _AWS_SECRET.sub(REDACTED, current)
    current = _ENV.sub(lambda match: f"{match.group(1)}={REDACTED}", current)
    current = _EMAIL.sub(REDACTED, current)
    current = _PHONE.sub(REDACTED, current)
    current = _HEX_KEY.sub(REDACTED, current)

    current, uncertain = _apply_seeds(current)
    if uncertain:
        return ScrubResult.hold("uncertain_secret")
    if (
        _PEM.search(current)
        or _JWT.search(current)
        or _PREFIXED.search(current)
        or _BEARER.search(current)
        or _HEX_KEY.search(current)
        or _EMAIL.search(current)
        or _PHONE.search(current)
        or _RESIDUAL.search(current)
    ):
        return ScrubResult.hold("uncertain_secret")
    return ScrubResult(current, True, "")


def _words() -> frozenset[str] | None:
    global _WORDS, _WORDS_LOADED
    if _WORDS_LOADED:
        return _WORDS
    _WORDS_LOADED = True
    try:
        raw = _WORDLIST.read_text(encoding="utf-8")
    except OSError:
        _WORDS = None
        return None
    _WORDS = frozenset(line.strip() for line in raw.splitlines() if line.strip())
    return _WORDS


def _apply_seeds(text: str) -> tuple[str, bool]:
    words = _words()
    if words is None:
        return "", True
    uncertain = False

    def repl(match: re.Match[str]) -> str:
        nonlocal uncertain
        tokens = re.split(r"\s+", match.group(0))
        pieces: list[str] = []
        index = 0
        changed = False
        while index < len(tokens):
            if tokens[index] not in words:
                pieces.append(tokens[index])
                index += 1
                continue
            end = index
            while end < len(tokens) and tokens[end] in words:
                end += 1
            length = end - index
            if length in _SEED_LENGTHS:
                pieces.append(REDACTED)
                changed = True
            elif length >= 10:
                uncertain = True
                pieces.extend(tokens[index:end])
            else:
                pieces.extend(tokens[index:end])
            index = end
        if uncertain or not changed:
            return match.group(0)
        return " ".join(pieces)

    rewritten = _SEED_RUN.sub(repl, text)
    if uncertain:
        return "", True
    return rewritten, False
