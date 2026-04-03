/**
 * Bridge API client for Plasmate handoff server
 * Handles communication with localhost:9271 bridge server
 */

const BRIDGE_URL = 'http://127.0.0.1:9271';

/**
 * Check if bridge server is available
 * @returns {Promise<{available: boolean, version?: string}>}
 */
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

/**
 * Submit a handoff to the bridge server
 * @param {Object} payload - Handoff payload
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
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
    
    // Handle expected errors gracefully
    if (resp.status === 404) {
      return { success: false, error: 'Handoff endpoint not available yet' };
    }
    
    const errText = await resp.text().catch(() => 'Unknown error');
    return { success: false, error: errText };
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return { success: false, error: 'Bridge server timed out' };
    }
    return { success: false, error: 'Bridge server not reachable' };
  }
}

/**
 * Get a specific handoff by ID
 * @param {string} id - Handoff ID
 * @returns {Promise<{success: boolean, handoff?: Object, error?: string}>}
 */
async function getHandoff(id) {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/handoff/${encodeURIComponent(id)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (resp.ok) {
      const handoff = await resp.json();
      return { success: true, handoff };
    }
    
    if (resp.status === 404) {
      return { success: false, error: 'Handoff not found' };
    }
    
    return { success: false, error: 'Failed to fetch handoff' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

/**
 * List all handoffs from the bridge
 * @returns {Promise<{success: boolean, handoffs?: Array, error?: string}>}
 */
async function listHandoffs() {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/handoffs`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, handoffs: data.handoffs || [] };
    }
    
    if (resp.status === 404) {
      return { success: false, error: 'Handoffs endpoint not available' };
    }
    
    return { success: false, error: 'Failed to list handoffs' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

/**
 * Cancel a pending handoff
 * @param {string} id - Handoff ID to cancel
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function cancelHandoff(id) {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/handoff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000)
    });
    
    if (resp.ok) {
      return { success: true };
    }
    
    if (resp.status === 404) {
      return { success: false, error: 'Handoff not found' };
    }
    
    return { success: false, error: 'Failed to cancel handoff' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

/**
 * Get agent status from bridge
 * @returns {Promise<{success: boolean, status?: Object, error?: string}>}
 */
async function getAgentStatus() {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/agent/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (resp.ok) {
      const status = await resp.json();
      return { success: true, status };
    }
    
    if (resp.status === 404) {
      return { success: false, error: 'Agent status not available' };
    }
    
    return { success: false, error: 'Failed to get agent status' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

/**
 * Push cookies to Plasmate (existing endpoint)
 * @param {Object} payload - {domain, cookies, expiry}
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
async function pushCookies(payload) {
  try {
    const resp = await fetch(`${BRIDGE_URL}/api/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
    
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, count: data.cookies_stored };
    }
    
    return { success: false, error: 'Failed to push cookies' };
  } catch (e) {
    return { success: false, error: 'Bridge server not reachable' };
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BRIDGE_URL,
    checkBridgeStatus,
    submitHandoff,
    getHandoff,
    listHandoffs,
    cancelHandoff,
    getAgentStatus,
    pushCookies
  };
}
