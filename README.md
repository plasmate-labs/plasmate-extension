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
4. Click **Push to Plasmate** (or copy to clipboard as fallback)

## Bridge Mode (Recommended)

The fastest way: run the Plasmate bridge server and cookies get pushed directly with one click. No copy-paste needed.

```bash
# Start the bridge server (runs on 127.0.0.1:9271)
plasmate auth serve
```

When the bridge is running, the extension shows a green dot with the version number. Click **Push to Plasmate** and cookies are stored instantly with AES-256-GCM encryption.

When the bridge is offline, the extension shows "Bridge offline" and falls back to copying a CLI command to your clipboard.

### Cookie expiry tracking

The extension sends each cookie's `expirationDate` from Chrome's cookie API. Plasmate tracks expiry so you get warnings when cookies are about to expire:

```bash
# Check cookie status
plasmate auth list
# ✓ x.com (2 cookies) - valid
# ⚠ github.com (2 cookies) - expires soon

plasmate auth info x.com
# Domain:    x.com
# Cookies:   2
# Encrypted: yes
#   ct0 - ✓ valid (expires in 14 days)
#   auth_token - ✓ valid (expires in 30 days)
```

## Manual Mode (No Bridge)

If you prefer not to run the bridge, the extension copies CLI commands to your clipboard:

**Copy CLI:**
```bash
plasmate auth set x.com --cookies "ct0=abc123; auth_token=xyz789"
```

**Copy JSON:**
```json
{
  "domain": "x.com",
  "cookies": {
    "ct0": "abc123",
    "auth_token": "xyz789"
  },
  "expiry": {
    "ct0": 1742500000,
    "auth_token": 1745000000
  }
}
```

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

## Privacy & Security

- **Permissions**: `cookies`, `activeTab`, `host_permissions` (needed for cross-domain cookie access in MV3)
- **Local only**: the extension only communicates with `127.0.0.1:9271` (the local Plasmate bridge). It never contacts any external server.
- **No storage**: nothing persisted in the extension itself
- **No analytics**: no tracking, no telemetry
- **Encrypted at rest**: cookies pushed via the bridge are encrypted with AES-256-GCM before being written to disk
- **Open source**: read every line, it's ~200 lines of JS

## Related

- [Plasmate](https://github.com/plasmate-labs/plasmate) - The browser engine for agents
- [Auth profiles](https://github.com/plasmate-labs/plasmate/issues/1) - Cookie persistence in Plasmate core
- [OpenClaw Skill](https://github.com/plasmate-labs/skill-openclaw) - Use Plasmate from OpenClaw agents

## License

[MPL-2.0](LICENSE) - Modifications to these files must stay open. Use freely in any project.
