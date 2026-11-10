# Stageglass demo (90 seconds)

Record the raw Hermes pane and the overlay side by side. The overlay starts at `http://127.0.0.1:8765/`. Every secret below is fake.

| Time | Do this | Say this |
| --- | --- | --- |
| 0:00–0:12 | Hermes session, overlay still **OFF**. Type a message that contains `sk-proj-FAKESTAGEGLASSKEY1234567890` and send it. Leave the raw pane visible. | "This is the real session. The key is on screen here, because this window is for me." |
| 0:12–0:28 | Run `/onair on`. Cut to the overlay. The chip reads **ON AIR**. The ask shows `[REDACTED]`, not the key. | "Stageglass is the audience copy. `/onair on`. The same message is up, and the key is gone." |
| 0:28–0:48 | Ask Hermes to list the files in the repo. Let a tool run. The overlay's tool line changes to that tool name, with a short argument summary. | "It follows the task. Tool name, a short argument summary, and the last few steps. Results stay in the real session." |
| 0:48–1:08 | Ask Hermes to run a command whose approval text includes an unfinished block: `-----BEGIN OPENSSH PRIVATE KEY-----` and no matching end line. Leave the approval waiting. The overlay chip flips to **HOLD** and the page goes blank. | "That approval is not a shape the scanner will swear to. The feed fails closed. Hold. Nothing raw." |
| 1:08–1:22 | In OBS, add a Browser Source pointed at `http://127.0.0.1:8765/`. Show the same **HOLD** frame inside the preview. | "OBS just loads that loopback page. It never leaves this machine. `127.0.0.1` only." |
| 1:22–1:30 | Cut to the repository: `https://github.com/Benito3262/stageglass`. | "Stageglass. The repo is the catalog pin." |

Do not use a real key, a real seed, or a real inbox. `/onair off` when the recording stops.
