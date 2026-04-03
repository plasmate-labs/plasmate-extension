/**
 * Plasmate Extension Background Service Worker
 * Handles context menus, side panel, and message routing
 */

// Import shared utilities inline (MV3 service workers don't support ES modules easily)
// These functions are duplicated here for service worker compatibility

const BRIDGE_URL = 'http://127.0.0.1:9271';

// ============ Bridge Functions ============

async function checkBridgeStatus() {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (resp.ok) {
      const data = await resp.json();
      return { available: true, version: data.version };
    }
    return { available: false };
  } catch (e) {
    return { available: false };
  }
}

async function submitHandoff(payload) {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, id: data.id || payload.id };
    }
    
    if (resp.status === 404) {
      return { success: false, error: 'Handoff endpoint not available yet' };
    }
    
    return { success: false, error: 'Bridge error' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

// ============ Handoff Functions ============

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function collectCookiesForUrls(urls) {
  const result = {};
  const seenDomains = new Set();
  
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    
    try {
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
      
      if (Object.keys(domainCookies).length > 0) {
        result[domain] = domainCookies;
      }
    } catch (e) {
      console.warn(`Failed to collect cookies for ${domain}:`, e);
    }
  }
  
  return result;
}

// ============ Storage Functions ============

const STORAGE_KEY = 'plasmate_handoffs';
const MAX_HANDOFFS = 50;

async function saveHandoff(handoff) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    
    const existingIndex = handoffs.findIndex(h => h.id === handoff.id);
    if (existingIndex >= 0) {
      handoffs[existingIndex] = handoff;
    } else {
      handoffs.unshift(handoff);
    }
    
    const trimmed = handoffs.slice(0, MAX_HANDOFFS);
    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
  } catch (e) {
    console.error('Failed to save handoff:', e);
  }
}

async function updateHandoffStatus(id, status, response = null) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    
    const index = handoffs.findIndex(h => h.id === id);
    if (index < 0) return false;
    
    handoffs[index].status = status;
    if (response !== null) {
      handoffs[index].response = response;
    }
    handoffs[index].updatedAt = new Date().toISOString();
    
    await chrome.storage.local.set({ [STORAGE_KEY]: handoffs });
    return true;
  } catch (e) {
    console.error('Failed to update handoff status:', e);
    return false;
  }
}

// ============ Context Menu Setup ============

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'handoff-page',
    title: 'Hand off this page to Plasmate',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'handoff-selection',
    title: 'Hand off selection to Plasmate',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'handoff-link',
    title: 'Hand off link to Plasmate',
    contexts: ['link']
  });
  
  console.log('Plasmate context menus registered');
});

// ============ Context Menu Handlers ============

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  
  const handoff = {
    id: generateId(),
    mode: 'read',
    tabs: [{
      url: tab.url,
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || ''
    }],
    instructions: '',
    cookies: {},
    context: {
      selectedText: '',
      scrollPosition: 0
    },
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  // Handle different context menu types
  if (info.menuItemId === 'handoff-selection' && info.selectionText) {
    handoff.context.selectedText = info.selectionText;
    handoff.instructions = `Review this selected text: "${info.selectionText.slice(0, 200)}${info.selectionText.length > 200 ? '...' : ''}"`;
  } else if (info.menuItemId === 'handoff-link' && info.linkUrl) {
    // Add the linked page instead of current page
    handoff.tabs = [{
      url: info.linkUrl,
      title: info.linkUrl,
      favIconUrl: ''
    }];
    handoff.instructions = `Review this linked page`;
  }
  
  // Collect cookies for the tab's URL
  handoff.cookies = await collectCookiesForUrls([handoff.tabs[0].url]);
  
  // Save locally first
  await saveHandoff(handoff);
  
  // Try to submit to bridge
  const result = await submitHandoff(handoff);
  if (result.success) {
    await updateHandoffStatus(handoff.id, 'processing');
  }
  
  // Open side panel to show the handoff
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.warn('Failed to open side panel:', e);
  }
});

// ============ Message Handlers ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async responses
  if (message.type === 'CHECK_BRIDGE') {
    checkBridgeStatus().then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SUBMIT_HANDOFF') {
    handleSubmitHandoff(message.payload).then(sendResponse);
    return true;
  }
  
  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab) {
        try {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }
  
  if (message.type === 'GET_ALL_TABS') {
    chrome.tabs.query({ currentWindow: true }).then(tabs => {
      sendResponse(tabs.filter(t => t.url && !t.url.startsWith('chrome://')));
    });
    return true;
  }
  
  if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse(tab || null);
    });
    return true;
  }
  
  if (message.type === 'CAPTURE_TAB_CONTEXT') {
    captureTabContext(message.tabId).then(sendResponse);
    return true;
  }
  
  if (message.type === 'COLLECT_COOKIES') {
    collectCookiesForUrls(message.urls).then(sendResponse);
    return true;
  }
});

async function handleSubmitHandoff(payload) {
  // Save locally first
  await saveHandoff(payload);
  
  // Try to submit to bridge
  const result = await submitHandoff(payload);
  
  if (result.success) {
    await updateHandoffStatus(payload.id, 'processing');
    return { success: true, id: payload.id, submitted: true };
  } else {
    // Keep as pending locally, will retry later
    return { success: true, id: payload.id, submitted: false, error: result.error };
  }
}

async function captureTabContext(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return {
          selectedText: window.getSelection()?.toString() || '',
          scrollPosition: window.scrollY || document.documentElement.scrollTop || 0
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
    return { selectedText: '', scrollPosition: 0 };
  } catch (e) {
    console.warn('Failed to capture tab context:', e);
    return { selectedText: '', scrollPosition: 0 };
  }
}

// ============ Side Panel Setup ============

// Enable side panel on all pages
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

console.log('Plasmate background service worker loaded');
