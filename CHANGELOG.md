# Changelog

## 0.2.0
- Published ready-to-load extension package `seedbed-capture-0.2.0.zip` in GitHub Releases and `store/`, with direct download instructions in README (EN/ID).
- Moved to its own repository.
- **License changed to MIT** (was 0-BSD): `LICENSE`, `package.json`, and the READMEs now say MIT, copyright (c) 2026 Finarfin12.
- Fallback mode (`obsidian://new`) now writes the Seedbed 0.7 properties (plain English names `type`, `status`, `created`, `review`, `gates`, `source`, `origin`) and a `[!trigger]` callout, and gives each note a time-stamped file name so a second capture with the same title cannot overwrite the first.
- Link length cap raised to 24,000 characters after measuring the Windows limit (31,800 arrives, 32,000 fails).

## 0.1.0
- First version: right-click or `Alt+Shift+S` to save selected text as a seed in Seedbed through an `obsidian://seedbed-capture` link.
