# Stageglass

Stageglass is a one-way glass between a Hermes session and an audience. It serves a small page on `127.0.0.1` that is safe to screen-share or drop into OBS as a Browser Source. The page shows the live task: the current user message, the current tool name, a short redacted argument summary, a pending approval, the last few steps, and an **ON AIR / HOLD / OFF** chip.

The operator's own Hermes window is unchanged. Stageglass only redacts the copy it puts on the overlay.

## Install

Hermes 0.22.5 or newer:

```bash
hermes plugins install https://github.com/Benito3262/stageglass --enable
```

From a checkout:

```bash
ln -s "$(pwd)" ~/.hermes/plugins/stageglass
hermes plugins enable stageglass
```

Then start a session (`hermes`, the CLI, or Desktop) and open the overlay.

## Usage

The overlay stays **OFF** until you opt in. Nothing from the session is drawn in that state.

```text
/onair on
/onair hold
/onair off
```

`/onair on` prints the page URL, which is `http://127.0.0.1:8765/` unless you change the port. The chip in the corner of the page matches the command:

| Chip | What the audience sees |
| --- | --- |
| ON AIR | The current ask, tool, argument summary, pending approval, and recent steps, after redaction |
| HOLD | A single status line. No session text |
| OFF | "Off air." No session text |

Known secret shapes are replaced with `[REDACTED]` before they are stored or rendered. That covers API keys and tokens (`sk-`, `gho_` / `ghp_`, `xox`, AWS-style access key ids, JWTs, bearer headers), private keys and PEM blocks, 12/15/18/21/24-word BIP39 seed phrases, `0x` hex private keys, email addresses, phone numbers, and `.env`-style `KEY=value` secrets.

If a string looks like a secret but does not match a shape the scanner will stand behind, the feed fails closed: it switches to **HOLD**, drops every field, and does not render the raw text. Turning `/onair on` again does not lift that hold. The next user message, or `/onair off` / `/onair hold`, does.

On Hermes builds that provide `ctx.redact_text`, Stageglass runs that scrubber first (forced on, so a `security.redact_secrets: false` setting cannot leak onto the page) and then its own scanner.

### OBS

1. Run `/onair on` and copy the URL.
2. In OBS, add a **Browser Source**.
3. Set the URL to `http://127.0.0.1:8765/`. Width 1280, height 720 is a good start.
4. Leave "Shutdown source when not visible" unchecked if the chip should keep updating while you are on another scene.
5. OBS has to run on the same machine as Hermes. The server does not accept connections from another computer.

### Desktop

The package also ships a Desktop half (`desktop/plugin.js`):

- a status-bar chip that reads **Stageglass ON AIR**, **HOLD**, or **OFF**
- a Settings → Plugins page that shows the overlay URL

Enable it under Capabilities → Plugins, then rescan or restart Desktop so the app copies `desktop/plugin.js` into place. The chip only receives the mode and the loopback URL. Session text stays on the overlay page.

The port is the `port` setting on that same settings page (default `8765`). Change it, then start a new Hermes session.

## Disclosures

- Stageglass starts a long-running background HTTP server. It binds **127.0.0.1 only**. There is no setting to bind `0.0.0.0` or any other address.
- To build the overlay it reads, in process, the current user message, the tool name, the tool arguments, and the approval command and description. Tool results and the rest of the conversation history are not stored and are not shown.
- It does not send anything off the machine. No telemetry, no third-party API, no paid service.
- It does not read `.env`, `auth.json`, or any other credential file, and it does not ask Hermes for a provider key.
- It does not run shell commands, does not approve or deny tool calls, and does not change the approval system.
- A safety hold is local to the overlay. The real session still shows the operator whatever Hermes shows them.

## Limitations

- Redaction is a heuristic. A novel token format can be missed only when it also fails the "looks unfinished" checks; those checks then hold the feed instead of guessing. A novel format that looks like ordinary prose can still slip through.
- A bare 64-character hex string is ambiguous (a hash or a private key), so it holds the feed. So does a 10-or-more-word run of BIP39 words that is not an exact seed length, an unfinished PEM block, and a token prefix that is too short to be a known key.
- A single tool argument longer than 20,000 characters holds the feed. The overlay does not try to skim a large file body.
- Approval lines appear only on the Hermes surfaces that fire `pre_approval_request`. A prompt that does not fire that hook is not shown.
- The Desktop chip updates when the session's process can reach a connected Desktop. A plain `hermes chat` with no Desktop attached still serves the web page.
- One process binds the port. A second session on the same port leaves the feed on HOLD and says so from `/onair`.
- The page and the Desktop copy are English only.
- This is not a boundary around the operator's own terminal. Do not point a camera at the raw session if that window contains a secret.

## Development

```bash
python3 -m unittest discover -s tests -v
hermes plugins validate . --install-deps
```

The tests include fake secret fixtures only. One test fails if any of those fixtures appears in the rendered page or the SSE payload.

## License

MIT. Copyright (c) 2026 Umunnakwe Emmanuel. See [LICENSE](LICENSE).
