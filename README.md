# Seedbed Capture

**English** · [Bahasa Indonesia](README.id.md)

A Chrome extension (Manifest V3) that saves selected text as a **seed** in the [Seedbed](../README.md) Obsidian plugin: the quote, its source, a trigger question, and your optional one-sentence answer. No server, no account, no network access.

> **Status: v0.2.0 (pre-release).** Tested on Windows 11 + Chrome. Not yet published on the Chrome Web Store.

## Why
Ideas that come up while browsing get lost because there's no time to write them down. A web clipper keeps what you read; Seedbed Capture keeps what you *think* about what you read, and puts it straight into Seedbed's Incubator.

## Install (unpacked)
1. Build: `npm ci`, `npm test`, `npm run build`, `npm run check-bundle`.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `dist/` folder.
3. Open the extension's options and enter your **vault name**.
4. Install **Seedbed 0.7.0 or newer** in that vault, or choose **fallback mode** in the options.

## Use
1. Select text on a web page, right-click, and choose **Save as seed**, or press `Alt+Shift+S` (change it in `chrome://extensions/shortcuts`).
2. Swap the trigger question if you like, and optionally write one sentence.
3. **Save** (`Ctrl+Enter`) or cancel (`Esc`).

Chrome may ask whether to open Obsidian. Seedbed then asks for its own confirmation (on by default). Sending the link doesn't prove the note was saved, because Obsidian sends nothing back. Check Obsidian, especially if you cancelled a dialog.

## The note it creates
Same format in Seedbed mode and fallback mode. Properties are plain English names without a prefix, and values are English, whatever the UI language. Seedbed only treats a note as its own when `type` is `idea` or `concept`; other notes are never touched. Fallback mode always uses the default names (`type`, `status`, `created`, `review`, `gates`, `source`, `origin`): it cannot know custom names set in the Seedbed plugin. `source` and `created` deliberately match names the Obsidian Web Clipper commonly uses.

```markdown
---
type: idea
status: seed
created: 2026-11-12
review: 2026-11-19
source: https://example.com/article
origin: capture
---
> [!quote] Quote — Page title
> the selected text…
> — [Page title](https://example.com/article)

> [!trigger] Trigger question
> Which part is not necessarily true?
> Answer: …
```

Example Dataview query (not run here; Dataview isn't installed in the test vault):

```dataview
TABLE review, source
FROM "Ide"
WHERE origin = "capture" AND status = "seed"
```

**Upgrading from 0.1.0:** 0.1.0 wrote the old 0.6 properties (`bengkel-*`, Indonesian values) and a `[!pemicu]` callout in fallback mode. Seedbed 0.7.0 still reads those notes and has a command **Migrate Seedbed properties** to convert them all (it skips and lists any note whose target property already holds another value); see Seedbed's README ("Upgrading from 0.6").

## Privacy and permissions
No fetch, XHR, WebSocket, telemetry, remote scripts, host permissions, or content scripts. Selected text only leaves the extension through a local `obsidian://` link.

| Permission | Why |
|---|---|
| `contextMenus` | The **Save as seed** right-click menu |
| `storage` | Options and the daily counter (local); the pending capture (session memory, used once) |
| `activeTab` | Temporary access to the current tab, only after you click or use the shortcut |
| `scripting` | Reads the selection when you use the keyboard shortcut or toolbar button |

There is no capture history. A capture you abandon stays in session storage until Chrome clears the session.

## Limits
- Quote: 1,000 characters by default; longer text is cut and marked `…(dipotong)`.
- Daily warning after 5 captures (adjustable). The counter counts sent links, including ones cancelled in Obsidian; it's a reminder, not an exact count of notes.
- Link length cap: 24,000 encoded characters. Measured on Windows 11: 31,800 arrives, 32,000 silently fails.
- Fallback mode uses Obsidian's `obsidian://new`. Obsidian overwrites a note with the same name, so fallback file names get a local `HHmmss` timestamp.

## Verification
36 tests, build, and bundle audit pass. Manual tests in a separate, signed-out Chrome profile: captures from Wikipedia, MDN, and paulgraham.com; saved answer; truncation; daily warning; fallback mode; Socratic promotion of a captured seed; English UI; capture-to-note time 0.26–0.34 s. Untested: other browsers and operating systems, many simultaneous capture windows. Detailed manual-test notes are kept in the author's build notes, not in this repository.

## Publishing to the Chrome Web Store
Not done yet. It needs a Chrome Web Store developer account (one-time registration fee), a ZIP of `dist/`, store listing text, screenshots, a privacy policy URL, and a justification for each permission. Then the listing goes through Google's review. A ready-to-upload package (ZIP, listing text, privacy answers, privacy policy, images, and a submission checklist) is in `store/`; see `store/SUBMISSION-CHECKLIST.md`. Nothing has been uploaded.

## License
[MIT](LICENSE), copyright (c) 2026 Finarfin12.
