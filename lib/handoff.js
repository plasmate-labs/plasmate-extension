/**
 * Handoff utilities for Plasmate extension
 * Handles ID generation, payload building, and context capture
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
function generateId() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Collect cookies for multiple URLs
 * Groups by domain and includes expiry info
 * @param {string[]} urls - Array of URLs to collect cookies for
 * @returns {Promise<Object>} - Cookies grouped by domain
 */
async function collectCookiesForUrls(urls) {
  const result = {};
  const seenDomains = new Set();
  
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    
    try {
      // Get cookies for exact domain
      const cookies = await chrome.cookies.getAll({ domain });
      // Also get cookies for parent domain (with leading dot)
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

/**
 * Build a handoff payload
 * @param {Array} tabs - Array of tab objects {url, title, favIconUrl}
 * @param {string} instructions - User instructions
 * @param {string} mode - 'read' | 'watch' | 'continue'
 * @param {Object} context - Optional context {selectedText, scrollPosition}
 * @returns {Object} - Handoff payload
 */
function buildHandoffPayload(tabs, instructions, mode, context = {}) {
  return {
    id: generateId(),
    mode: mode || 'read',
    tabs: tabs.map(t => ({
      url: t.url,
      title: t.title || '',
      favIconUrl: t.favIconUrl || ''
    })),
    instructions: instructions || '',
    cookies: {}, // Will be populated separately
    context: {
      selectedText: context.selectedText || '',
      scrollPosition: context.scrollPosition || 0
    },
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
}

/**
 * Capture context from a tab (selection, scroll position)
 * Uses scripting API to inject and execute capture script
 * @param {number} tabId - Tab ID to capture from
 * @returns {Promise<Object>} - {selectedText, scrollPosition}
 */
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
    // May fail on chrome:// pages, extensions, etc.
    console.warn('Failed to capture tab context:', e);
    return { selectedText: '', scrollPosition: 0 };
  }
}

/**
 * Get simplified tab info from chrome.tabs.Tab object
 * @param {Object} tab - Chrome tab object
 * @returns {Object} - {url, title, favIconUrl, id}
 */
function simplifyTab(tab) {
  return {
    id: tab.id,
    url: tab.url || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || ''
  };
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    extractDomain,
    collectCookiesForUrls,
    buildHandoffPayload,
    captureTabContext,
    simplifyTab
  };
}
