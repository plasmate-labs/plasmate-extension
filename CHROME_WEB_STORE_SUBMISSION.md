# Chrome Web Store Submission (Plasmate Extension)

This repo is a plain MV3 extension (no build step required). The Chrome Web Store wants a ZIP containing the extension files.

## 1) Bump version

- Update `manifest.json` `version`
- Commit and push

## 2) Create the upload ZIP

From the repo root:

```bash
VERSION=$(jq -r '.version' manifest.json)
OUT="/tmp/plasmate-extension-${VERSION}.zip"
rm -f "$OUT"

git ls-files \
  | grep -v '^\.gitignore$' \
  | zip -q -@ "$OUT"

echo "$OUT"
unzip -l "$OUT" | head
```

Notes:
- `git ls-files` ensures the ZIP contains only tracked files.
- We exclude `.gitignore` just to keep the package tidy.

## 3) Upload in the Chrome Web Store

1. Go to the Developer Dashboard: https://chrome.google.com/webstore/devconsole
2. Select the Plasmate item.
3. Go to **Package**.
4. Upload the ZIP from step 2.
5. Review any permission warnings and submit for review.

## 4) Post-submit checklist

- Verify the version shown in the dashboard matches `manifest.json`.
- After approval, install from the store and confirm:
  - side panel opens
  - context menu handoff works
  - cookie export prompts and produces a file
