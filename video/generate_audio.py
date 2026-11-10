#!/usr/bin/env python3
"""Speak each line with Piper, then write src/manifest.json for Remotion.

Spoken text uses "Stage glass" so the voice does not say "stage-a-glass".
On-screen captions keep the brand spelling.
"""

from __future__ import annotations

import json
import os
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AUDIO = ROOT / "public" / "audio"
MANIFEST = ROOT / "src" / "manifest.json"
PIPER = Path("/tmp/piper/piper/piper")
MODEL = Path("/tmp/piper/en_US-ryan-medium.onnx")
ESPEAK = Path("/tmp/piper/piper/espeak-ng-data")
FPS = 30
# 1.0 is Piper's default. 1.58 lands this script near 65 seconds.
LENGTH_SCALE = os.environ.get("STAGEGLASS_LENGTH", "1.58")

# scene, spoken, caption. Spoken "Stage glass" avoids the stage-a-glass phonemes.
LINES = [
    ("title", "Stage glass.", "Stageglass."),
    ("title", "A one way glass for a Hermes session.", "A one-way glass for a Hermes session."),
    ("title", "You keep the real conversation.", "You keep the real conversation."),
    ("title", "The audience gets a calm feed.", "The audience gets a calm feed."),
    ("flow", "Hermes stays in charge.", "Hermes stays in charge."),
    ("flow", "Stage glass only listens.", "Stageglass only listens."),
    ("flow", "Hooks carry the message, the tool, and any approval.", "Hooks carry the message, the tool, and any approval."),
    ("flow", "The feed can never approve a command.", "The feed can never approve a command."),
    ("gate", "A known key turns into redacted.", "A known key turns into [REDACTED]."),
    ("gate", "Watch the letters change.", "Watch the letters change."),
    ("gate", "If the scanner is not sure, the feed fails closed.", "If the scanner is not sure, the feed fails closed."),
    ("gate", "The gate shuts, and the chip says hold.", "The gate shuts, and the chip says HOLD."),
    ("key", "Here is a live session.", "Here is a live session."),
    ("key", "The fake key is on the operator screen.", "The fake key is on the operator screen."),
    ("key", "Turn the feed on.", "Turn the feed on."),
    ("key", "The audience copy hides it.", "The audience copy hides it."),
    ("tool", "A real task updates the tool name as the agent works.", "A real task updates the tool name as the agent works."),
    ("hold", "Then an approval carries a private key the scanner will not swear to.", "Then an approval carries a private key the scanner will not swear to."),
    ("hold", "Hold.", "HOLD."),
    ("hold", "Nothing raw is left on screen.", "Nothing raw is left on screen."),
    ("hold", "You still see the prompt. They do not.", "You still see the prompt. They do not."),
    ("end", "Add that page in OBS.", "Add that page in OBS."),
    ("end", "Loopback only, on the same machine.", "Loopback only, on the same machine."),
    ("end", "Install Stage glass from GitHub.", "Install Stageglass from GitHub."),
    ("end", "Here is the repo, and the landing page.", "Here is the repo, and the landing page."),
]


def wav_seconds(path: Path) -> float:
    with wave.open(str(path)) as handle:
        return handle.getnframes() / handle.getframerate()


def main() -> None:
    AUDIO.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = "/tmp/piper/piper"
    scenes: dict[str, dict] = {}
    order: list[str] = []
    for index, (scene, spoken, caption) in enumerate(LINES):
        name = f"s{index:02d}.wav"
        target = AUDIO / name
        subprocess.run(
            [
                str(PIPER),
                "--model", str(MODEL),
                "--espeak_data", str(ESPEAK),
                "--length_scale", LENGTH_SCALE,
                "--sentence_silence", "0.08",
                "--output_file", str(target),
            ],
            input=spoken.encode(),
            check=True,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        frames = max(8, round(wav_seconds(target) * FPS))
        line = {"file": f"audio/{name}", "frames": frames, "caption": caption, "spoken": spoken}
        if scene not in scenes:
            scenes[scene] = {"id": scene, "lines": []}
            order.append(scene)
        scenes[scene]["lines"].append(line)
    payload = {
        "fps": FPS,
        "scenes": [
            {**scenes[key], "frames": sum(line["frames"] for line in scenes[key]["lines"])}
            for key in order
        ],
    }
    MANIFEST.write_text(json.dumps(payload, indent=2) + "\n")
    total = sum(scene["frames"] for scene in payload["scenes"]) / FPS
    print(f"seconds {total:.2f}")
    for scene in payload["scenes"]:
        print(f"{scene['id']:6} {scene['frames'] / FPS:6.2f}s")


if __name__ == "__main__":
    main()
