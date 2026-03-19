# Plasmate Cookie Export

Chrome extension for exporting auth cookies to [Plasmate](https://plasmate.app).

One click. No dev tools.

## Install (Developer Mode)

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this directory

## Usage

1. Navigate to a site and log in normally
2. Click the Plasmate icon in the toolbar
3. Select which cookies to export (auth cookies are pre-selected for known sites)
4. Click **Copy CLI** to get a ready-to-paste command:

```bash
plasmate auth set x.com --cookies "ct0=abc123; auth_token=xyz789"
```

## Supported Sites

Pre-configured cookie recommendations for:

- **X/Twitter**: `ct0`, `auth_token`
- **GitHub**: `user_session`, `__Host-user_session_same_site`
- **LinkedIn**: `li_at`, `JSESSIONID`
- **Reddit**: `reddit_session`, `token_v2`
- **Instagram**: `sessionid`, `csrftoken`

Any site works - these just get auto-selected.

## Permissions

- `cookies`: Read cookies for the active tab's domain
- `activeTab`: Get the current tab's URL

No network access. No data leaves your browser.

## License

Apache-2.0
