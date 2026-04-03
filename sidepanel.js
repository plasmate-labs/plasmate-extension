/**
 * Plasmate Side Panel Controller
 * Manages tab selection, handoff creation, and history display
 */

// State
let allTabs = [];
let currentTabId = null;
let selectedMode = 'read';
let bridgeAvailable = false;

// DOM Elements
const tabListEl = document.getElementById('tab-list');
const instructionsEl = document.getElementById('instructions');
const charCountEl = document.getElementById('char-count');
const handoffBtn = document.getElementById('handoff-btn');
const bridgeStatusEl = document.getElementById('bridge-status');
const historyToggle = document.getElementById('history-toggle');
const historyList = document.getElementById('history-list');
const toastEl = document.getElementById('toast');

// ============ Initialization ============

document.addEventListener('DOMContentLoaded', async () => {
  await initBridgeStatus();
  await loadTabs();
  await loadHistory();
  setupEventListeners();
  
  // Refresh bridge status periodically
  setInterval(initBridgeStatus, 30000);
});

async function initBridgeStatus() {
  const result = await checkBridgeStatus();
  bridgeAvailable = result.available;
  updateBridgeStatusUI(result.available, result.version);
}

function updateBridgeStatusUI(available, version) {
  const dot = bridgeStatusEl.querySelector('.status-dot');
  const text = bridgeStatusEl.querySelector('.status-text');
  
  if (available) {
    dot.className = 'status-dot online';
    text.textContent = `Bridge v${version}`;
    bridgeStatusEl.title = 'Plasmate bridge server is running';
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Bridge offline';
    bridgeStatusEl.title = 'Start with: plasmate auth serve';
  }
}

// ============ Tab Loading ============

async function loadTabs() {
  try {
    // Get current tab first
    const currentTab = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' });
    currentTabId = currentTab?.id || null;
    
    // Get all tabs
    allTabs = await chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' });
    
    renderTabs();
    updateHandoffButton();
  } catch (e) {
    console.error('Failed to load tabs:', e);
    tabListEl.innerHTML = '<div class="loading">Failed to load tabs</div>';
  }
}

function renderTabs() {
  if (!allTabs || allTabs.length === 0) {
    tabListEl.innerHTML = '<div class="loading">No tabs available</div>';
    return;
  }
  
  tabListEl.innerHTML = allTabs.map(tab => {
    const isCurrentTab = tab.id === currentTabId;
    const domain = extractDomain(tab.url);
    
    return `
      <label class="tab-item ${isCurrentTab ? 'selected' : ''}" data-tab-id="${tab.id}">
        <input type="checkbox" ${isCurrentTab ? 'checked' : ''}>
        ${tab.favIconUrl 
          ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" alt="">`
          : `<div class="tab-favicon-placeholder">?</div>`
        }
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
          <div class="tab-domain">${escapeHtml(domain)}</div>
        </div>
      </label>
    `;
  }).join('');
  
  // Add click handlers to update visual state
  tabListEl.querySelectorAll('.tab-item').forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      item.classList.toggle('selected', checkbox.checked);
      updateHandoffButton();
    });
  });
}

function getSelectedTabs() {
  const selected = [];
  tabListEl.querySelectorAll('.tab-item').forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox.checked) {
      const tabId = parseInt(item.dataset.tabId);
      const tab = allTabs.find(t => t.id === tabId);
      if (tab) selected.push(tab);
    }
  });
  return selected;
}

// ============ Event Listeners ============

function setupEventListeners() {
  // Select all/none
  document.getElementById('select-all').addEventListener('click', () => {
    tabListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      cb.closest('.tab-item').classList.add('selected');
    });
    updateHandoffButton();
  });
  
  document.getElementById('select-none').addEventListener('click', () => {
    tabListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.tab-item').classList.remove('selected');
    });
    updateHandoffButton();
  });
  
  // Instructions character count
  instructionsEl.addEventListener('input', () => {
    const len = instructionsEl.value.length;
    charCountEl.textContent = `${len} / 2000`;
    updateHandoffButton();
  });
  
  // Mode selector
  document.querySelectorAll('.mode-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      option.querySelector('input[type="radio"]').checked = true;
      selectedMode = option.querySelector('input[type="radio"]').value;
    });
  });
  
  // Handoff button
  handoffBtn.addEventListener('click', handleHandoff);
  
  // History toggle
  historyToggle.addEventListener('click', () => {
    historyToggle.classList.toggle('open');
    historyList.classList.toggle('collapsed');
  });
}

function updateHandoffButton() {
  const selectedTabs = getSelectedTabs();
  handoffBtn.disabled = selectedTabs.length === 0;
}

// ============ Handoff Submission ============

async function handleHandoff() {
  const selectedTabs = getSelectedTabs();
  if (selectedTabs.length === 0) return;
  
  handoffBtn.disabled = true;
  handoffBtn.textContent = 'Preparing...';
  
  try {
    // Build tab data
    const tabs = selectedTabs.map(t => ({
      url: t.url,
      title: t.title || '',
      favIconUrl: t.favIconUrl || ''
    }));
    
    // Capture context from current tab if selected
    let context = { selectedText: '', scrollPosition: 0 };
    if (currentTabId && selectedTabs.some(t => t.id === currentTabId)) {
      try {
        context = await chrome.runtime.sendMessage({ 
          type: 'CAPTURE_TAB_CONTEXT', 
          tabId: currentTabId 
        });
      } catch (e) {
        console.warn('Failed to capture context:', e);
      }
    }
    
    // Build payload
    const payload = buildHandoffPayload(
      tabs,
      instructionsEl.value.trim(),
      selectedMode,
      context
    );
    
    // Collect cookies for all selected tabs
    const urls = tabs.map(t => t.url);
    payload.cookies = await chrome.runtime.sendMessage({ 
      type: 'COLLECT_COOKIES', 
      urls 
    });
    
    // Submit
    const result = await chrome.runtime.sendMessage({ 
      type: 'SUBMIT_HANDOFF', 
      payload 
    });
    
    if (result.success) {
      if (result.submitted) {
        showToast('Handoff sent to agent');
      } else {
        showToast('Handoff saved locally (bridge offline)');
      }
      
      // Clear instructions
      instructionsEl.value = '';
      charCountEl.textContent = '0 / 2000';
      
      // Refresh history
      await loadHistory();
    } else {
      showToast('Failed to create handoff');
    }
  } catch (e) {
    console.error('Handoff failed:', e);
    showToast('Error creating handoff');
  } finally {
    handoffBtn.disabled = false;
    handoffBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Hand Off to Agent
    `;
    updateHandoffButton();
  }
}

// ============ History ============

async function loadHistory() {
  try {
    const handoffs = await getHandoffs(20);
    renderHistory(handoffs);
  } catch (e) {
    console.error('Failed to load history:', e);
    historyList.innerHTML = '<div class="empty-history">Failed to load history</div>';
  }
}

function renderHistory(handoffs) {
  if (!handoffs || handoffs.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No handoffs yet</div>';
    return;
  }
  
  historyList.innerHTML = handoffs.map(h => {
    const time = formatRelativeTime(h.createdAt);
    const tabCount = h.tabs?.length || 0;
    
    return `
      <div class="history-item" data-id="${escapeHtml(h.id)}">
        <div class="history-header">
          <span class="history-time">${escapeHtml(time)}</span>
          <span class="status-badge ${h.status}">${h.status}</span>
        </div>
        <div class="history-meta">
          <span class="history-tabs">${tabCount} page${tabCount !== 1 ? 's' : ''}</span>
          <span class="history-mode">${escapeHtml(h.mode || 'read')}</span>
        </div>
        <div class="history-content">
          ${h.instructions ? `<div class="history-instructions">${escapeHtml(h.instructions)}</div>` : ''}
          ${h.response ? `<div class="history-response">${escapeHtml(h.response)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers for expand/collapse
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });
  });
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// ============ Utilities ============

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Listen for storage changes to update history in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.plasmate_handoffs) {
    renderHistory(changes.plasmate_handoffs.newValue || []);
  }
});
