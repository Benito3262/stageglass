"""Redaction unit tests. Every secret string here is fake."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from redact import REDACTED, scrub  # noqa: E402

SK = "sk-proj-FAKESTAGEGLASSKEY1234567890"
GHP = "ghp_FAKESTAGEGLASS123456"
GHO = "gho_FAKESTAGEGLASS123456"
SLACK = "xoxb-FAKESTAGEGLASS-token"
AWS = "AKIAFAKESTAGEGLASSXX"
JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
    ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
)
BEARER = "Bearer FAKESTAGEGLASS-bearer-token"
PEM = "-----BEGIN PRIVATE KEY-----\nFAKESTAGEGLASSKEYMATERIAL\n-----END PRIVATE KEY-----"
SEED = "abandon ability able about above absent absorb abstract absurd abuse access accident"
HEX = "0x" + ("ab" * 32)
EMAIL = "stageglass-demo@example.com"
PHONE = "+1 415 555 0199"
ENV = "API_KEY=FAKESTAGEGLASS-env-secret-value"
AWS_SECRET = "aws_secret_access_key=FAKESTAGEGLASSAWSSECRETKEYEXAMPLE1234567890AB"

FIXTURES = [SK, GHP, GHO, SLACK, AWS, JWT, BEARER, PEM, SEED, HEX, EMAIL, PHONE, ENV, AWS_SECRET]


class RedactTests(unittest.TestCase):
    def test_known_fixtures_are_removed(self) -> None:
        for secret in FIXTURES:
            result = scrub(f"Note: {secret}.")
            self.assertTrue(result.confident, secret)
            self.assertNotIn(secret, result.text)
            self.assertNotIn("FAKESTAGEGLASS", result.text)
            self.assertIn(REDACTED, result.text)

    def test_hex_body_does_not_remain(self) -> None:
        result = scrub(HEX)
        self.assertTrue(result.confident)
        self.assertNotIn("ab" * 32, result.text)

    def test_partial_token_holds(self) -> None:
        result = scrub("use sk-short in the command")
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")
        self.assertEqual(result.reason, "uncertain_secret")

    def test_unterminated_pem_holds(self) -> None:
        raw = "-----BEGIN OPENSSH PRIVATE KEY-----\nFAKESTAGEGLASS-NOT-CLOSED"
        result = scrub(raw)
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")
        self.assertNotIn("NOT-CLOSED", result.text)

    def test_bare_hex_holds(self) -> None:
        raw = "cd" * 32
        result = scrub(f"hash {raw}")
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")

    def test_near_seed_holds(self) -> None:
        words = SEED.split()[:11]
        result = scrub(" ".join(words))
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")

    def test_ordinary_sentence_stays(self) -> None:
        text = "Please list the files in this repository and tell me what the readme says."
        result = scrub(text)
        self.assertTrue(result.confident, result.reason)
        self.assertEqual(result.text, text)

    def test_host_redactor_is_layered(self) -> None:
        def host(text: str) -> str:
            return text.replace(SK, "«redacted:sk-…»")

        result = scrub(f"{SK} and {EMAIL}", host=host)
        self.assertTrue(result.confident, result.text)
        self.assertNotIn(SK, result.text)
        self.assertNotIn(EMAIL, result.text)
        self.assertNotIn("«redacted", result.text)

    def test_host_redactor_failure_holds(self) -> None:
        def host(text: str) -> str:
            raise RuntimeError("scrubber failed")

        result = scrub(f"hello {SK}", host=host)
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")
        self.assertEqual(result.reason, "redactor_error")
        self.assertNotIn(SK, result.text)

    def test_non_string_holds(self) -> None:
        result = scrub(None)  # type: ignore[arg-type]
        self.assertFalse(result.confident)
        self.assertEqual(result.text, "")


if __name__ == "__main__":
    unittest.main()
