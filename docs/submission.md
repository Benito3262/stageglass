# Stageglass submission kit

Prepared only. Nothing here has been posted, opened, or submitted.

Catalog pin, unchanged: `9d208c532e7a6262646608d73089f1b95a1700cd`
That commit contains the full plugin. Later commits add the site and these docs.

Landing page (intended): https://benito3262.github.io/stageglass/
Repo: https://github.com/Benito3262/stageglass

## Upstream PR

Do not open this until you mean to. Target: `NousResearch/hermes-agent`, file `plugin-catalog/stageglass.yaml`, copied from `docs/catalog-entry.yaml`.

**Title**

```text
plugin-catalog: add stageglass (Hermes Agent Plugin Hackathon entry)
```

**Body**

```markdown
## What it does

Stageglass is a one-way glass between a Hermes session and an audience. It serves a loopback page for screen sharing and OBS. The page shows the current user message, the current tool name, a short redacted argument summary, a pending approval, the last few steps, and an ON AIR / HOLD / OFF chip.

Known secret shapes are replaced with `[REDACTED]` before they are stored. If a string looks like a secret and the scanner will not stand behind the match, the feed fails closed: the chip flips to HOLD and the page shows nothing from the session.

## Hermes surfaces

- Hooks: `pre_llm_call`, `pre_tool_call`, `post_tool_call`, `pre_approval_request`, `post_approval_response`, `on_session_start`, `on_session_end`
- Slash command: `/onair on|off|hold`
- Desktop: a status-bar chip and a Settings page with the overlay URL (`desktop/plugin.js`), plus the `port` setting from `config_schema`
- No tools, no middleware, no required env vars, no Python dependencies

## Disclosures (catalog rule 13)

- A long-running HTTP server, bound to 127.0.0.1 only. There is no setting that binds any other address.
- In-process read of the current user message, tool name, tool arguments, and approval command and description, only so they can be redacted for that local page. Tool results and the rest of the transcript are not stored or shown.
- No network egress, no telemetry, no credential files, no shell commands, and no change to Hermes approvals.

## Validation

On Hermes 0.23.1, `hermes plugins validate --install-deps` and `hermes plugins doctor --ci` passed. 22 unit tests pass, including a fixture leak test and HOLD-on-uncertainty tests.

Pin: `9d208c532e7a6262646608d73089f1b95a1700cd`
Version: `1.0.0`
`requires_hermes`: `>=0.22.5`

Owner submission for https://github.com/Benito3262/stageglass. Screenshots of a live session (raw pane versus the redacted ON AIR page, and an approval that flips the feed to HOLD) are in the landing page and the repo README's sibling site.
```

## X post

Not posted. Under 280 characters, one tag, no hashtags.

```text
shipped stageglass for the hermes hackathon. your session can show a key. the audience page on 127.0.0.1 redacts it, or it just goes HOLD. @NousResearch https://benito3262.github.io/stageglass/
```

## Typeform

Form: https://form.typeform.com/to/FwJLvOln
Not submitted. Fields read from the public form definition.

| Field | Answer |
| --- | --- |
| Plugin Title | Stageglass |
| Plugin Description | A one-way glass for a live Hermes session. The audience sees the task, never the secret. |
| Email Address | Not in this repo. Use the owner's address. |
| Discord Username | Not in this repo. Use the owner's Discord name. |
| X Demo Post Link | Not posted, on purpose. Paste the URL after the draft above is published. The form says a demo post tagging @nousresearch is required for the final submission. |
| Statement: submit a catalog PR | No answer. Follow the catalog instructions, then continue. The prepared PR is above. It has not been opened. |
| GitHub Link to your Hermes Plugin Pull Request | None yet. Open the PR above, then paste that URL. |

## What was checked

- Landing page layout at desktop and mobile widths, served locally.
- Live Hermes 0.23.1 session with only fake secrets: key visible in the operator pane, ON AIR feed redacts it, a file listing updates the tool name to `terminal`, an approval containing an unfinished fake private key flips the feed to HOLD. The command was denied and did not run.
- Demo stills at several timestamps. The composer placeholder that reads like an error is cropped out of the footage used in the video.
