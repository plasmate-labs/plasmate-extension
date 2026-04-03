// Known domains and their important auth cookies
const PRESETS = {
  'x.com': ['ct0', 'auth_token'],
  'twitter.com': ['ct0', 'auth_token'],
  'github.com': ['user_session', '__Host-user_session_same_site', '_gh_sess'],
  'linkedin.com': ['li_at', 'JSESSIONID'],
  'reddit.com': ['reddit_session', 'token_v2'],
  'facebook.com': ['c_user', 'xs'],
  'instagram.com': ['sessionid', 'csrftoken'],
};

// Bridge server config
const BRIDGE_URL = 'http://127.0.0.1:9271';

let allCookies = [];
let currentDomain = '';
let bridgeAvailable = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if bridge server is running
  checkBridgeStatus();

  // Setup handoff button
  setupHandoffButton();

  // Get the active tab's URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    document.getElementById('domain').textContent = 'no tab';
    document.getElementById('cookies').innerHTML = '<div class="empty">Open a webpage first</div>';
    return;
  }

  const url = new URL(tab.url);
  currentDomain = url.hostname.replace(/^www\./, '');
  document.getElementById('domain').textContent = currentDomain;

  // Get cookies for this domain
  const cookies = await chrome.cookies.getAll({ domain: currentDomain });

  // Also try with leading dot (subdomains)
  const dotCookies = await chrome.cookies.getAll({ domain: '.' + currentDomain });
  const seen = new Set();
  allCookies = [];

  for (const c of [...cookies, ...dotCookies]) {
    const key = c.name + '|' + c.domain;
    if (!seen.has(key)) {
      seen.add(key);
      allCookies.push(c);
    }
  }

  // Sort: recommended first, then alphabetical
  const recommended = getRecommended();
  allCookies.sort((a, b) => {
    const aRec = recommended.includes(a.name);
    const bRec = recommended.includes(b.name);
    if (aRec && !bRec) return -1;
    if (!aRec && bRec) return 1;
    return a.name.localeCompare(b.name);
  });

  renderCookies();
  setupButtons();
});

async function checkBridgeStatus() {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/status`, { method: 'GET' });
    if (resp.ok) {
      bridgeAvailable = true;
      const data = await resp.json();
      updateBridgeStatus(true, data.version);
    } else {
      updateBridgeStatus(false);
    }
  } catch (e) {
    updateBridgeStatus(false);
  }
}

function updateBridgeStatus(available, version) {
  const statusEl = document.getElementById('bridge-status');
  if (available) {
    statusEl.innerHTML = `<span class="status-dot online"></span>Bridge v${version}`;
    statusEl.title = 'Plasmate bridge server is running';
  } else {
    statusEl.innerHTML = `<span class="status-dot offline"></span>Bridge offline`;
    statusEl.title = 'Start with: plasmate auth serve';
  }
}

function getRecommended() {
  for (const [domain, cookies] of Object.entries(PRESETS)) {
    if (currentDomain === domain || currentDomain.endsWith('.' + domain)) {
      return cookies;
    }
  }
  return [];
}

function renderCookies() {
  const container = document.getElementById('cookies');
  const recommended = getRecommended();

  if (allCookies.length === 0) {
    container.innerHTML = '<div class="empty">No cookies found for this domain</div>';
    disableButtons();
    return;
  }

  container.innerHTML = allCookies.map((c, i) => {
    const isRec = recommended.includes(c.name);
    const masked = c.value.length > 20
      ? c.value.slice(0, 8) + '...' + c.value.slice(-4)
      : c.value;

    return `
      <label class="cookie ${isRec ? 'recommended' : ''}">
        <input type="checkbox" data-index="${i}" ${isRec ? 'checked' : ''}>
        <span class="cookie-name">${esc(c.name)}${isRec ? '<span class="tag">recommended</span>' : ''}</span>
        <span class="cookie-value">${esc(masked)}</span>
      </label>
    `;
  }).join('');
}

function getSelected() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => allCookies[parseInt(cb.dataset.index)]);
}

function setupButtons() {
  // Push to Plasmate (primary action)
  document.getElementById('push-plasmate').addEventListener('click', async () => {
    const selected = getSelected();
    if (selected.length === 0) return;

    // Build request with cookies and expiry info from Chrome API
    const cookies = {};
    const expiry = {};
    for (const c of selected) {
      cookies[c.name] = c.value;
      if (c.expirationDate) {
        expiry[c.name] = Math.floor(c.expirationDate);
      }
    }

    const payload = { domain: currentDomain, cookies, expiry };

    if (bridgeAvailable) {
      // Try to push directly to bridge
      try {
        const resp = await fetch(`${BRIDGE_URL}/api/cookies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          const data = await resp.json();
          showMessage(`Pushed ${data.cookies_stored} cookies to Plasmate`);
          return;
        }
      } catch (e) {
        // Fall through to clipboard
      }
    }

    // Fallback: copy CLI command to clipboard
    const cookieStr = selected.map(c => `${c.name}=${c.value}`).join('; ');
    const cmd = `plasmate auth set ${currentDomain} --cookies "${cookieStr}"`;
    await navigator.clipboard.writeText(cmd);
    showMessage('Copied CLI command (bridge offline)');
  });

  document.getElementById('copy-cli').addEventListener('click', async () => {
    const selected = getSelected();
    if (selected.length === 0) return;

    const cookieStr = selected.map(c => `${c.name}=${c.value}`).join('; ');
    const cmd = `plasmate auth set ${currentDomain} --cookies "${cookieStr}"`;
    await navigator.clipboard.writeText(cmd);
    showMessage('Copied!');
  });

  document.getElementById('copy-json').addEventListener('click', async () => {
    const selected = getSelected();
    if (selected.length === 0) return;

    const cookies = {};
    const expiry = {};
    for (const c of selected) {
      cookies[c.name] = c.value;
      if (c.expirationDate) {
        expiry[c.name] = Math.floor(c.expirationDate);
      }
    }
    const obj = { domain: currentDomain, cookies, expiry };
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    showMessage('Copied!');
  });

  document.getElementById('select-all').addEventListener('click', () => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  });

  document.getElementById('select-none').addEventListener('click', () => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  });
}

function disableButtons() {
  document.getElementById('push-plasmate').disabled = true;
  document.getElementById('copy-cli').disabled = true;
  document.getElementById('copy-json').disabled = true;
}

function showMessage(text) {
  const el = document.getElementById('copied');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Setup handoff button in popup
function setupHandoffButton() {
  const handoffBtn = document.getElementById('handoff-page');
  if (!handoffBtn) return;

  handoffBtn.addEventListener('click', async () => {
    // Try to open side panel first
    try {
      const result = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      if (result && result.success) {
        window.close(); // Close popup when side panel opens
        return;
      }
    } catch (e) {
      console.warn('Side panel not available:', e);
    }

    // Fallback: create quick handoff for current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showMessage('No page to hand off');
      return;
    }

    handoffBtn.disabled = true;
    handoffBtn.textContent = 'Sending...';

    try {
      // Build quick handoff payload
      const payload = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        mode: 'read',
        tabs: [{
          url: tab.url,
          title: tab.title || '',
          favIconUrl: tab.favIconUrl || ''
        }],
        instructions: '',
        cookies: {},
        context: { selectedText: '', scrollPosition: 0 },
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      // Collect cookies for the page
      const domain = new URL(tab.url).hostname.replace(/^www\./, '');
      const cookies = await chrome.cookies.getAll({ domain });
      const dotCookies = await chrome.cookies.getAll({ domain: '.' + domain });
      const seen = new Set();
      const domainCookies = {};

      for (const c of [...cookies, ...dotCookies]) {
        const key = c.name + '|' + c.domain;
        if (seen.has(key)) continue;
        seen.add(key);
        domainCookies[c.name] = {
          value: c.value,
          expiry: c.expirationDate ? Math.floor(c.expirationDate) : null
        };
      }
      payload.cookies[domain] = domainCookies;

      // Try to capture context
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => ({
            selectedText: window.getSelection()?.toString() || '',
            scrollPosition: window.scrollY || 0
          })
        });
        if (results?.[0]?.result) {
          payload.context = results[0].result;
        }
      } catch (e) {
        // Ignore context capture errors
      }

      // Submit via background
      const result = await chrome.runtime.sendMessage({ type: 'SUBMIT_HANDOFF', payload });

      if (result && result.success) {
        if (result.submitted) {
          showMessage('Handoff sent to agent');
        } else {
          showMessage('Handoff saved locally');
        }
      } else {
        showMessage('Handoff failed');
      }
    } catch (e) {
      console.error('Handoff error:', e);
      showMessage('Error creating handoff');
    } finally {
      handoffBtn.disabled = false;
      handoffBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Hand off this page
      `;
    }
  });
}
