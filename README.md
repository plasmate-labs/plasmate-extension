<p align="center">
  <img src="plasmate-mark.png" alt="Plasmate" width="80" />
</p>

<h1 align="center">Plasmate Cookie Export</h1>

<p align="center">
  Chrome extension for exporting auth cookies to <a href="https://plasmate.app">Plasmate</a>.<br/>
  One click. No dev tools.
</p>

<p align="center">
  <a href="https://plasmate.app">Website</a> &middot;
  <a href="https://docs.plasmate.app">Docs</a> &middot;
  <a href="https://github.com/plasmate-labs/plasmate">Engine</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/permissions-minimal-brightgreen" alt="Minimal Permissions" />
</p>

---

Agents need authenticated access to sites like X, GitHub, and LinkedIn. But automated login triggers bot detection. The solution: **you log in normally, then hand the cookies to Plasmate.**

This extension makes that handoff instant.

## How It Works

1. Navigate to a site and log in normally
2. Click the Plasmate icon in the toolbar
3. Auth cookies are pre-selected for known sites
4. Click **Copy CLI** to get a ready-to-paste command:

```bash
plasmate auth set x.com --cookies "ct0=abc123; auth_token=xyz789"
```

5. Paste into terminal. Your agent can now browse that site authenticated.

## Install

> Chrome Web Store listing coming soon. For now, install via developer mode.

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this directory

## Supported Sites

Pre-configured cookie recommendations for popular platforms:

| Site | Cookies |
|------|---------|
| X / Twitter | `ct0`, `auth_token` |
| GitHub | `user_session`, `__Host-user_session_same_site` |
| LinkedIn | `li_at`, `JSESSIONID` |
| Reddit | `reddit_session`, `token_v2` |
| Instagram | `sessionid`, `csrftoken` |

Every site works. These just get auto-selected for convenience.

## Output Formats

**CLI** (recommended):
```bash
plasmate auth set x.com --cookies "ct0=abc123; auth_token=xyz789"
```

**JSON** (programmatic):
```json
{
  "domain": "x.com",
  "cookies": {
    "ct0": "abc123",
    "auth_token": "xyz789"
  }
}
```

## Privacy & Security

- **Permissions**: `cookies` + `activeTab` only
- **No network access**: the extension never phones home
- **No storage**: nothing persisted, clipboard only
- **No analytics**: no tracking, no telemetry
- **Open source**: read every line, it's ~80 lines of JS

## Related

- [Plasmate](https://github.com/plasmate-labs/plasmate) - The browser engine for agents
- [Auth profiles](https://github.com/plasmate-labs/plasmate/issues/1) - Cookie persistence in Plasmate core
- [OpenClaw Skill](https://github.com/plasmate-labs/skill-openclaw) - Use Plasmate from OpenClaw agents

## License

[MPL-2.0](LICENSE) - Modifications to these files must stay open. Use freely in any project.
