/**
 * Storage utilities for Plasmate handoffs
 * Uses chrome.storage.local for persistence
 */

const STORAGE_KEY = 'plasmate_handoffs';
const MAX_HANDOFFS = 50;

/**
 * Save a handoff to local storage
 * @param {Object} handoff - Handoff object to save
 * @returns {Promise<void>}
 */
async function saveHandoff(handoff) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    
    // Check if handoff already exists (update case)
    const existingIndex = handoffs.findIndex(h => h.id === handoff.id);
    if (existingIndex >= 0) {
      handoffs[existingIndex] = handoff;
    } else {
      // Add to beginning (newest first)
      handoffs.unshift(handoff);
    }
    
    // Trim to max size
    const trimmed = handoffs.slice(0, MAX_HANDOFFS);
    
    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
  } catch (e) {
    console.error('Failed to save handoff:', e);
    throw e;
  }
}

/**
 * Get handoffs from local storage
 * @param {number} limit - Maximum number to return
 * @returns {Promise<Array>} - Array of handoffs (newest first)
 */
async function getHandoffs(limit = 20) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    return handoffs.slice(0, limit);
  } catch (e) {
    console.error('Failed to get handoffs:', e);
    return [];
  }
}

/**
 * Get a single handoff by ID
 * @param {string} id - Handoff ID
 * @returns {Promise<Object|null>}
 */
async function getHandoffById(id) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    return handoffs.find(h => h.id === id) || null;
  } catch (e) {
    console.error('Failed to get handoff:', e);
    return null;
  }
}

/**
 * Update a handoff's status and optionally add response
 * @param {string} id - Handoff ID
 * @param {string} status - New status ('pending', 'processing', 'complete', 'failed')
 * @param {string} response - Optional agent response
 * @returns {Promise<boolean>} - True if updated
 */
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

/**
 * Delete a handoff by ID
 * @param {string} id - Handoff ID to delete
 * @returns {Promise<boolean>}
 */
async function deleteHandoff(id) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    
    const filtered = handoffs.filter(h => h.id !== id);
    if (filtered.length === handoffs.length) return false;
    
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    return true;
  } catch (e) {
    console.error('Failed to delete handoff:', e);
    return false;
  }
}

/**
 * Clear old handoffs (older than specified days)
 * @param {number} olderThanDays - Delete handoffs older than this many days
 * @returns {Promise<number>} - Number of handoffs removed
 */
async function clearOldHandoffs(olderThanDays = 7) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const handoffs = data[STORAGE_KEY] || [];
    
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const filtered = handoffs.filter(h => {
      const created = new Date(h.createdAt).getTime();
      return created > cutoff;
    });
    
    const removed = handoffs.length - filtered.length;
    if (removed > 0) {
      await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    }
    
    return removed;
  } catch (e) {
    console.error('Failed to clear old handoffs:', e);
    return 0;
  }
}

/**
 * Clear all handoffs
 * @returns {Promise<void>}
 */
async function clearAllHandoffs() {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear handoffs:', e);
    throw e;
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    saveHandoff,
    getHandoffs,
    getHandoffById,
    updateHandoffStatus,
    deleteHandoff,
    clearOldHandoffs,
    clearAllHandoffs
  };
}
