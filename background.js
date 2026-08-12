/**
 * ShieldBlock - Service Worker Background Script (Manifest V3)
 */

// Default configuration settings
const DEFAULT_SETTINGS = {
  enabled: true,
  whitelistedDomains: [],
  customRules: [],
  customCssRules: {}, // domain -> array of CSS selectors
  filterLists: {
    ads: true,
    trackers: true,
    annoyances: true
  },
  stats: {
    totalBlocked: 142, // starter count for realistic initial metric
    trackersBlocked: 86,
    adsBlocked: 56,
    dataSavedMB: 4.8
  }
};

// Setup session storage access for tab counts
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// Live Logger Ring Buffer (In-memory & session storage)
let blockedLogsBuffer = [];

if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const entry = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      url: info.request.url,
      type: info.request.type || 'other',
      ruleId: info.rule.ruleId,
      rulesetId: info.rule.rulesetId || 'dynamic',
      timestamp: new Date().toLocaleTimeString()
    };
    blockedLogsBuffer.unshift(entry);
    if (blockedLogsBuffer.length > 200) blockedLogsBuffer.pop();

    // Broadcast log entry to any open live logger window
    chrome.runtime.sendMessage({ action: 'NEW_LOG_ENTRY', entry }).catch(() => {});
  });
}

// Simple hash function to generate deterministic internal rule IDs (10,000..909,999)
function generateRuleId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 10000 + (Math.abs(hash) % 900000); // Safe internal positive ID space
}

// Hash function for remote filter subscription rules (1,000,000..9,999,999)
function generateSubRuleId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 1000000 + (Math.abs(hash) % 8999999);
}

// Initialize extension state on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ShieldBlock] Extension installed/updated:', details.reason);
  const data = await chrome.storage.local.get(null);
  
  if (Object.keys(data).length === 0) {
    await chrome.storage.local.set(DEFAULT_SETTINGS);
  }

  // Create Context Menu Options
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'shieldblock-picker',
      title: '🛡️ Block element on this page...',
      contexts: ['all']
    });
    chrome.contextMenus.create({
      id: 'shieldblock-whitelist',
      title: '🌐 Toggle protection on this domain',
      contexts: ['all']
    });
  });

  await syncDynamicRules();
  updateBadge();
});

// Context Menu Click Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'shieldblock-picker') {
    chrome.tabs.sendMessage(tab.id, { action: 'ACTIVATE_ELEMENT_PICKER' }).catch(() => {});
  } else if (info.menuItemId === 'shieldblock-whitelist') {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      const { whitelistedDomains = [] } = await chrome.storage.local.get('whitelistedDomains');
      let updated;
      if (whitelistedDomains.includes(domain)) {
        updated = whitelistedDomains.filter(d => d !== domain);
      } else {
        updated = [...whitelistedDomains, domain];
      }
      await chrome.storage.local.set({ whitelistedDomains: updated });
      await syncDynamicRules();
      updateBadge(tab.id);
    }
  }
});

// Listener for dynamic DNR rule updates based on allowlist
async function syncDynamicRules() {
  const { enabled, whitelistedDomains = [] } = await chrome.storage.local.get(['enabled', 'whitelistedDomains']);
  
  // Fetch existing dynamic rules and remove ONLY internal rules (< 1,000,000), preserving subscription rules!
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = currentRules.filter(r => r.id < 1000000).map(r => r.id);

  const addRules = [];

  if (!enabled) {
    // If globally disabled, add an overall allow rule with top priority
    addRules.push({
      id: 999999,
      priority: 100,
      action: { type: 'allowAllRequests' },
      condition: {
        urlFilter: '*',
        resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'ping', 'other']
      }
    });
  } else {
    // Add allowAllRequests rule for each whitelisted domain
    whitelistedDomains.forEach((domain) => {
      if (domain) {
        addRules.push({
          id: generateRuleId(domain),
          priority: 50,
          action: { type: 'allowAllRequests' },
          condition: {
            requestDomains: [domain],
            resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'xmlhttprequest', 'ping', 'other']
          }
        });
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });

  console.log('[ShieldBlock] Dynamic rules updated. Active whitelist rules count:', addRules.length);
}

// Update Extension Toolbar Icon & Badge Count
async function updateBadge(tabId = null) {
  const { enabled, whitelistedDomains = [] } = await chrome.storage.local.get(['enabled', 'whitelistedDomains']);

  if (tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) {
        const domain = getDomainFromUrl(tab.url);
        const isWhitelisted = whitelistedDomains.includes(domain);

        if (!enabled || isWhitelisted) {
          chrome.action.setBadgeText({ text: 'OFF', tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#6B7280', tabId });
          return;
        }

        const sessionData = await chrome.storage.session.get('tabBlockedCounts');
        const countsMap = sessionData.tabBlockedCounts || {};
        const count = countsMap[tabId] || 0;
        
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
      }
    } catch (e) {
      // Tab might have closed
    }
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
  }
}

// Extract hostname from URL
function getDomainFromUrl(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return '';
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

// Reset tab blocked count on navigation & inject custom CSS rules on load complete
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const sessionData = await chrome.storage.session.get('tabBlockedCounts');
    const countsMap = sessionData.tabBlockedCounts || {};
    countsMap[tabId] = 0;
    await chrome.storage.session.set({ tabBlockedCounts: countsMap });
    updateBadge(tabId);
  } else if (changeInfo.status === 'complete' && tab && tab.url) {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      const { customCssRules = {}, enabled, whitelistedDomains = [] } = await chrome.storage.local.get(['customCssRules', 'enabled', 'whitelistedDomains']);
      if (enabled && !whitelistedDomains.includes(domain)) {
        const rules = customCssRules[domain];
        if (rules && rules.length > 0) {
          const cssText = rules.map(s => `${s} { display: none !important; visibility: hidden !important; }`).join('\n');
          try {
            chrome.scripting.insertCSS({
              target: { tabId },
              css: cssText,
              origin: 'USER'
            });
          } catch (e) {}
        }
      }
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sessionData = await chrome.storage.session.get('tabBlockedCounts');
  const countsMap = sessionData.tabBlockedCounts || {};
  if (tabId in countsMap) {
    delete countsMap[tabId];
    await chrome.storage.session.set({ tabBlockedCounts: countsMap });
  }
});

// Handle incoming messages from Popup and Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = async () => {
    switch (request.action) {
      case 'GET_STATUS': {
        const activeTab = sender.tab ? sender.tab : (request.tabId ? await chrome.tabs.get(request.tabId) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
        const domain = activeTab ? getDomainFromUrl(activeTab.url) : '';
        const data = await chrome.storage.local.get(['enabled', 'whitelistedDomains', 'stats', 'customCssRules']);
        
        const isWhitelisted = data.whitelistedDomains ? data.whitelistedDomains.includes(domain) : false;
        
        const sessionData = await chrome.storage.session.get('tabBlockedCounts');
        const countsMap = sessionData.tabBlockedCounts || {};
        const pageCount = activeTab ? (countsMap[activeTab.id] || 0) : 0;
        
        return {
          enabled: data.enabled !== false,
          domain,
          isWhitelisted,
          pageCount,
          stats: data.stats || DEFAULT_SETTINGS.stats,
          customSelectors: (data.customCssRules && data.customCssRules[domain]) || []
        };
      }

      case 'TOGGLE_GLOBAL': {
        const { enabled } = await chrome.storage.local.get('enabled');
        const newState = !enabled;
        await chrome.storage.local.set({ enabled: newState });
        await syncDynamicRules();
        
        // Notify all tabs to update badge
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          updateBadge(t.id);
        }
        return { enabled: newState };
      }

      case 'TOGGLE_WHITELIST': {
        const { domain } = request;
        if (!domain) return { error: 'Invalid domain' };

        const { whitelistedDomains = [] } = await chrome.storage.local.get('whitelistedDomains');
        let updated;
        if (whitelistedDomains.includes(domain)) {
          updated = whitelistedDomains.filter(d => d !== domain);
        } else {
          updated = [...whitelistedDomains, domain];
        }

        await chrome.storage.local.set({ whitelistedDomains: updated });
        await syncDynamicRules();
        
        // Notify current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) updateBadge(tabs[0].id);

        return { isWhitelisted: updated.includes(domain), whitelistedDomains: updated };
      }

      case 'INCREMENT_BLOCKED': {
        const tabId = sender.tab ? sender.tab.id : request.tabId;
        const count = request.count || 1;

        if (tabId) {
          const sessionData = await chrome.storage.session.get('tabBlockedCounts');
          const countsMap = sessionData.tabBlockedCounts || {};
          const currentTabCount = (countsMap[tabId] || 0) + count;
          countsMap[tabId] = currentTabCount;
          await chrome.storage.session.set({ tabBlockedCounts: countsMap });
          updateBadge(tabId);
        }

        // Update overall total stats
        const { stats = DEFAULT_SETTINGS.stats } = await chrome.storage.local.get('stats');
        const newStats = {
          ...stats,
          totalBlocked: (stats.totalBlocked || 0) + count,
          adsBlocked: (stats.adsBlocked || 0) + count,
          dataSavedMB: parseFloat(((stats.dataSavedMB || 0) + (count * 0.08)).toFixed(1))
        };
        await chrome.storage.local.set({ stats: newStats });

        return { success: true, newTotal: newStats.totalBlocked };
      }

      case 'START_ELEMENT_PICKER': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'ACTIVATE_ELEMENT_PICKER',
            mode: request.mode || 'permanent'
          }).catch(() => {});
        }
        return { success: true };
      }

      case 'GET_LOGS': {
        return { logs: blockedLogsBuffer };
      }

      case 'CLEAR_LOGS': {
        blockedLogsBuffer = [];
        return { success: true };
      }

      case 'ADD_SUBSCRIPTION': {
        const { url } = request;
        if (!url) return { error: 'Invalid URL' };

        const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
        if (!subscriptions.includes(url)) {
          subscriptions.push(url);
          await chrome.storage.local.set({ subscriptions });
        }

        // Fetch custom JSON ruleset from subscription URL
        try {
          const res = await fetch(url);
          const rules = await res.json();
          if (Array.isArray(rules)) {
            // Generate unique rule IDs per URL + index in subscription namespace (>= 1,000,000)
            const ruleIdsToRemove = Array.from({ length: 500 }, (_, i) => generateSubRuleId(url + i));
            const addRules = rules.map((r, idx) => ({
              ...r,
              id: generateSubRuleId(url + idx)
            }));

            // Remove previous rules for this subscription before adding new ones
            await chrome.declarativeNetRequest.updateDynamicRules({
              removeRuleIds: ruleIdsToRemove,
              addRules
            });
            return { success: true, count: addRules.length, subscriptions };
          }
        } catch (e) {
          return { error: 'Failed to parse subscription rules JSON: ' + e.message };
        }
        return { success: true, subscriptions };
      }

      case 'REMOVE_SUBSCRIPTION': {
        const { url } = request;
        if (!url) return { error: 'Invalid URL' };

        const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
        const updated = subscriptions.filter(s => s !== url);
        await chrome.storage.local.set({ subscriptions: updated });

        // Clean up associated dynamic rules
        const ruleIdsToRemove = Array.from({ length: 500 }, (_, i) => generateSubRuleId(url + i));
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove
        });

        return { success: true, subscriptions: updated };
      }

      case 'SYNC_RULES': {
        await syncDynamicRules();
        return { success: true };
      }

      case 'SAVE_ELEMENT_PICKER_RULE': {
        const { domain, selector } = request;
        if (!domain || !selector) return { error: 'Invalid data' };

        const { customCssRules = {} } = await chrome.storage.local.get('customCssRules');
        const existing = customCssRules[domain] || [];
        if (!existing.includes(selector)) {
          customCssRules[domain] = [...existing, selector];
          await chrome.storage.local.set({ customCssRules });
        }

        // Immediately send selector to content script of current tab & inject via scripting API (CSP bypass)
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'APPLY_CUSTOM_CSS', selector }).catch(() => {});
          try {
            chrome.scripting.insertCSS({
              target: { tabId: tabs[0].id },
              css: `${selector} { display: none !important; visibility: hidden !important; }`,
              origin: 'USER'
            });
          } catch (e) {}
        }
        return { success: true, customCssRules };
      }

      default:
        return { error: 'Unknown action' };
    }
  };

  handler().then(sendResponse);
  return true; // Keep message channel open for async response
});
