#!/usr/bin/env python3
"""Build the silent demo timeline and a synthesized music bed.

There is no narration. On-screen lines advance at about 2.5 words per second,
and every scene change lands on a beat. The music and the sound effects are
generated here, so the track is original and free to use with no attribution.
"""

from __future__ import annotations

import json
import math
import re
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
WAV = ROOT / "public" / "bed.wav"
TIMINGS = ROOT / "src" / "timings.json"
SCRIPT = ROOT / "script.txt"
SR = 44100
FPS = 30
BPM = 100
BEAT = 60 / BPM
WORDS_PER_SECOND = 2.5

# A line is spoken text, with {one token} for a phrase that should appear together.
SCENES = [
    {
        "id": "problem",
        "headline": "THE PROBLEM",
        "lines": [
            "You stream your AI agent.",
            "Everyone watching sees your screen.",
            "One tool call can flash an API key.",
            "A wallet key. Or an email.",
        ],
    },
    {
        "id": "idea",
        "headline": "THE IDEA",
        "lines": [
            "What if they saw a second, clean screen?",
            "Stageglass is a Hermes Agent plugin.",
            "A one-way glass between you and your viewers.",
        ],
    },
    {
        "id": "how",
        "headline": "HOW IT WORKS",
        "lines": [
            "It hooks into Hermes itself.",
            "Every message, tool call, and approval passes through.",
            "Keys, tokens, seed phrases, and emails are redacted before the audience.",
            "A known key turns into {[REDACTED]}.",
            "Not sure? The feed goes to {HOLD}.",
        ],
    },
    {
        "id": "use",
        "headline": "HOW TO USE IT",
        "lines": [
            "Install Stageglass from GitHub.",
            {"text": "Type {/onair on}.", "clip": "onair"},
            "Open http://127.0.0.1:8765.",
            "Or add that link as an OBS Browser Source.",
            "Share that window, not the terminal.",
            "{/onair hold} pauses. {/onair off} stops.",
        ],
    },
    {
        "id": "proof",
        "headline": "PROOF",
        "lines": [
            {"text": "Here is a real Hermes session.", "clip": "key"},
            {"text": "The fake key stays on your screen.", "clip": "key"},
            {"text": "The audience copy says {[REDACTED]}.", "clip": "key"},
            {"text": "The tool name updates as the agent works.", "clip": "tool"},
            {"text": "A private key sends the feed to {HOLD}.", "clip": "hold"},
        ],
    },
    {
        "id": "end",
        "headline": "STAGEGLASS",
        "lines": [
            "Stageglass.",
            "Go live without leaking.",
            {"text": "{github.com/Benito3262/stageglass}", "min": 3.6},
            {"text": "{benito3262.github.io/stageglass}", "min": 3.6},
        ],
    },
]


def tokens(line: str) -> list[str]:
    found = []
    for match in re.finditer(r"\{([^{}]+)\}|(\S+)", line):
        piece = match.group(1) or match.group(2)
        if piece in {".", ",", "?", "!"} and found:
            found[-1] += piece
        else:
            found.append(piece)
    return found


def line_of(item: str | dict) -> tuple[str, str | None, float]:
    if isinstance(item, str):
        return item, None, 2.4
    return item["text"], item.get("clip"), float(item.get("min", 2.4))


def snap(seconds: float, minimum: float) -> float:
    beats = max(1, math.ceil(max(seconds, minimum) / BEAT - 1e-9))
    return round(beats * BEAT, 3)


def build_timeline() -> dict:
    scenes = []
    sentences = []
    words = []
    script_lines = []
    cursor = 0.0
    for scene in SCENES:
        scene_start = cursor
        for item in scene["lines"]:
            text, clip, minimum = line_of(item)
            pieces = tokens(text)
            reveal = len(pieces) / WORDS_PER_SECOND
            duration = snap(reveal, minimum)
            readable = " ".join(pieces)
            sentences.append({
                "scene": scene["id"],
                "start": round(cursor, 3),
                "end": round(cursor + duration, 3),
                "clip": clip,
                "text": readable,
            })
            gap = min(reveal, duration - 0.3) / max(1, len(pieces))
            for index, piece in enumerate(pieces):
                start = cursor + index * gap
                bare = piece.rstrip(".,?!")
                words.append({
                    "text": piece,
                    "start": round(start, 3),
                    "end": round(start + gap, 3),
                    "scene": scene["id"],
                    "emphasis": bare in {"[REDACTED]", "HOLD", "Stageglass"} or bare.startswith("/") or "github" in bare or bare == "API",
                })
            script_lines.append(readable)
            cursor += duration
        scenes.append({
            "id": scene["id"],
            "headline": scene["headline"],
            "start": round(scene_start, 3),
            "end": round(cursor, 3),
        })
        script_lines.append("")
    return {
        "fps": FPS,
        "duration": round(cursor, 3),
        "bpm": BPM,
        "words_per_second": WORDS_PER_SECOND,
        "music": "Original synthesized bed. No third-party recording. CC0, no attribution required.",
        "scenes": scenes,
        "sentences": sentences,
        "words": words,
        "script": "\n".join(script_lines).strip() + "\n",
    }


def env_exp(n: int, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.exp(-decay * t).astype(np.float32)


def sine(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t + phase).astype(np.float32)


def place(buffer: np.ndarray, sound: np.ndarray, at: float, gain: float) -> None:
    start = int(at * SR)
    if start >= len(buffer) or start < 0:
        return
    end = min(len(buffer), start + len(sound))
    buffer[start:end] += sound[: end - start] * gain


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    dt = 1 / SR
    rc = 1 / (2 * math.pi * cutoff)
    alpha = dt / (rc + dt)
    out = np.empty_like(signal)
    acc = 0.0
    for index, sample in enumerate(signal):
        acc += alpha * (float(sample) - acc)
        out[index] = acc
    return out


def synthesize(duration: float, hold_at: float, cuts: list[float]) -> np.ndarray:
    n = int(round(duration * SR))
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    bar = BEAT * 4
    chords = [
        [146.83, 174.61, 220.00, 293.66],  # Dm
        [174.61, 220.00, 261.63, 349.23],  # F
        [130.81, 164.81, 196.00, 261.63],  # C
        [110.00, 164.81, 220.00, 329.63],  # Am
    ]
    melody = [293.66, 349.23, 440.00, 392.00, 349.23, 293.66, 261.63, 293.66]
    bars = int(duration / bar) + 1
    for index in range(bars):
        start = index * bar
        notes = chords[index % len(chords)]
        pad_n = int((bar + 0.2) * SR)
        pad = np.zeros(pad_n, dtype=np.float32)
        for note in notes:
            for detune in (-0.4, 0.0, 0.35):
                pad += sine(note * (2 ** (detune / 1200)), pad_n) * 0.045
        attack = np.minimum(np.arange(pad_n) / (0.35 * SR), 1)
        release = np.minimum((pad_n - np.arange(pad_n)) / (0.25 * SR), 1)
        pad *= np.minimum(attack, release).astype(np.float32)
        place(left, pad, start, 0.55)
        place(right, pad, start + 0.012, 0.55)
        root = sine(notes[0] / 2, int(0.7 * SR)) * env_exp(int(0.7 * SR), 3.2)
        place(left, root, start, 0.55)
        place(right, root, start, 0.55)
        for beat in (0.0, BEAT * 2):
            kick_n = int(0.12 * SR)
            sweep = np.sin(2 * np.pi * np.linspace(90, 48, kick_n) * np.arange(kick_n) / SR)
            kick = (sweep * env_exp(kick_n, 28)).astype(np.float32)
            place(left, kick, start + beat, 0.42)
            place(right, kick, start + beat, 0.42)
        for step in range(8):
            hat_n = int(0.03 * SR)
            hat = (np.random.uniform(-1, 1, hat_n).astype(np.float32) * env_exp(hat_n, 90))
            hat = hat - lowpass(hat, 1800)
            place(left, hat, start + step * (BEAT / 2), 0.035)
            place(right, hat, start + step * (BEAT / 2), 0.03)
        note = melody[index % len(melody)]
        bell_n = int(BEAT * 0.9 * SR)
        bell = sine(note, bell_n) * env_exp(bell_n, 4.5) * 0.12
        place(left, bell, start + BEAT, 0.7)
        place(right, bell, start + BEAT + 0.008, 0.7)

    for cut in cuts:
        whoosh_n = int(0.42 * SR)
        noise = np.random.uniform(-1, 1, whoosh_n).astype(np.float32)
        sweep = lowpass(noise, 400) * 0
        # Rising band: difference of two lowpasses whose cutoff follows the envelope.
        bright = noise - lowpass(noise, 700)
        shape = np.sin(np.linspace(0, math.pi, whoosh_n)).astype(np.float32) ** 1.4
        whoosh = bright * shape * 0.55
        place(left, whoosh, cut - 0.18, 0.55)
        place(right, whoosh, cut - 0.16, 0.55)

    if hold_at > 0:
        thud_n = int(0.55 * SR)
        thud = sine(78, thud_n) * env_exp(thud_n, 6) + sine(46, thud_n) * env_exp(thud_n, 4) * 0.6
        place(left, thud.astype(np.float32), hold_at, 0.9)
        place(right, thud.astype(np.float32), hold_at, 0.9)

    mix_l = lowpass(left, 9000)
    mix_r = lowpass(right, 9000)
    fade_in = int(1.4 * SR)
    fade_out = int(2.6 * SR)
    mix_l[:fade_in] *= np.linspace(0, 1, fade_in)
    mix_r[:fade_in] *= np.linspace(0, 1, fade_in)
    mix_l[-fade_out:] *= np.linspace(1, 0, fade_out)
    mix_r[-fade_out:] *= np.linspace(1, 0, fade_out)
    peak = max(np.max(np.abs(mix_l)), np.max(np.abs(mix_r)), 1e-6)
    mix_l *= 0.82 / peak
    mix_r *= 0.82 / peak
    return np.stack([mix_l, mix_r], axis=1)


def add_ticks(stereo: np.ndarray, word_times: list[float]) -> None:
    tick_n = int(0.028 * SR)
    tick = sine(1680, tick_n) * env_exp(tick_n, 140) * 0.18
    noise = np.random.uniform(-1, 1, tick_n).astype(np.float32) * env_exp(tick_n, 200) * 0.04
    click = (tick + noise).astype(np.float32)
    for at in word_times:
        gain = min(1.0, at / 0.5)
        place(stereo[:, 0], click, at, 0.42 * gain)
        place(stereo[:, 1], click, at, 0.34 * gain)


def write_wav(path: Path, stereo: np.ndarray) -> None:
    pcm = np.clip(stereo, -1, 1)
    interleaved = (pcm * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(interleaved.tobytes())


def main() -> None:
    timeline = build_timeline()
    hold = next(word["start"] for word in timeline["words"] if word["text"].rstrip(".,?!") == "HOLD" and word["scene"] == "how")
    cuts = [scene["start"] for scene in timeline["scenes"] if scene["start"] > 0]
    stereo = synthesize(timeline["duration"], hold, cuts)
    add_ticks(stereo, [word["start"] for word in timeline["words"]])
    fade_out = int(2.2 * SR)
    stereo[-fade_out:, 0] *= np.linspace(1, 0, fade_out)
    stereo[-fade_out:, 1] *= np.linspace(1, 0, fade_out)
    peak = max(float(np.max(np.abs(stereo))), 1e-6)
    stereo *= 0.9 / peak
    WAV.parent.mkdir(parents=True, exist_ok=True)
    write_wav(WAV, stereo)
    payload = {key: value for key, value in timeline.items() if key != "script"}
    TIMINGS.write_text(json.dumps(payload, indent=2) + "\n")
    SCRIPT.write_text(timeline["script"])
    words = len(timeline["words"])
    print(f"duration {timeline['duration']:.2f}s")
    print(f"words {words} pace {words / timeline['duration']:.2f} wps including holds")
    for scene in timeline["scenes"]:
        print(f"{scene['id']:8} {scene['start']:6.2f} {scene['end']:6.2f}")
    print(f"hold_thud {hold:.2f}")


if __name__ == "__main__":
    main()
