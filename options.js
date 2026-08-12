/**
 * ShieldBlock - Options & Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tab Switching
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');

      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // Load Data
  await refreshDashboardData();

  // Filter List Toggles Logic
  const toggles = [
    { id: 'toggle-list-ads', key: 'ads', ruleset: 'rules_ads' },
    { id: 'toggle-list-trackers', key: 'trackers', ruleset: 'rules_trackers' },
    { id: 'toggle-list-annoyances', key: 'annoyances', ruleset: 'rules_annoyances' }
  ];

  toggles.forEach(({ id, key, ruleset }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async (e) => {
        const { filterLists = { ads: true, trackers: true, annoyances: true } } = await chrome.storage.local.get('filterLists');
        filterLists[key] = e.target.checked;
        await chrome.storage.local.set({ filterLists });
        
        // Update enabled rulesets dynamically
        if (e.target.checked) {
          await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: [ruleset] });
        } else {
          await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [ruleset] });
        }
      });
    }
  });

  // Handle Allowlist Add Form
  const allowlistInput = document.getElementById('allowlist-input');
  const addAllowlistBtn = document.getElementById('add-allowlist-btn');
  const clearAllowlistBtn = document.getElementById('clear-allowlist-btn');

  addAllowlistBtn.addEventListener('click', async () => {
    const domain = allowlistInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!domain) return;

    const { whitelistedDomains = [] } = await chrome.storage.local.get('whitelistedDomains');
    if (!whitelistedDomains.includes(domain)) {
      const updated = [...whitelistedDomains, domain];
      await chrome.storage.local.set({ whitelistedDomains: updated });
      await chrome.runtime.sendMessage({ action: 'TOGGLE_WHITELIST', domain });
      allowlistInput.value = '';
      await refreshDashboardData();
    }
  });

  clearAllowlistBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all whitelisted domains?')) {
      await chrome.storage.local.set({ whitelistedDomains: [] });
      await chrome.runtime.sendMessage({ action: 'TOGGLE_GLOBAL' }); // trigger sync
      await refreshDashboardData();
    }
  });

  // Handle Reset Stats Button
  const resetStatsBtn = document.getElementById('reset-stats-btn');
  resetStatsBtn.addEventListener('click', async () => {
    if (confirm('Reset all blocked ad counters and bandwidth statistics?')) {
      const emptyStats = { totalBlocked: 0, trackersBlocked: 0, adsBlocked: 0, dataSavedMB: 0 };
      await chrome.storage.local.set({ stats: emptyStats });
      await refreshDashboardData();
    }
  });

  // Export JSON Config
  const exportConfigBtn = document.getElementById('export-config-btn');
  exportConfigBtn.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shieldblock-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import JSON Config
  const importConfigBtn = document.getElementById('import-config-btn');
  const importFileInput = document.getElementById('import-file-input');

  if (importConfigBtn && importFileInput) {
    importConfigBtn.addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          if (importedData && typeof importedData === 'object') {
            await chrome.storage.local.set(importedData);
            await chrome.runtime.sendMessage({ action: 'SYNC_RULES' });
            await refreshDashboardData();
            alert('Settings successfully imported!');
          }
        } catch (err) {
          alert('Failed to parse settings JSON file. Please ensure it is a valid backup file.');
        }
      };
      reader.readAsText(file);
    });
  }

  // Handle Add Subscription
  const subInput = document.getElementById('sub-input');
  const addSubBtn = document.getElementById('add-sub-btn');

  if (addSubBtn) {
    addSubBtn.addEventListener('click', async () => {
      const url = subInput.value.trim();
      if (!url) return;

      addSubBtn.textContent = 'Subscribing...';
      const res = await chrome.runtime.sendMessage({ action: 'ADD_SUBSCRIPTION', url });
      addSubBtn.textContent = 'Subscribe List';

      if (res && res.error) {
        alert(res.error);
      } else {
        subInput.value = '';
        alert(`Successfully subscribed! Loaded ${res.count || 0} remote rules.`);
        await refreshDashboardData();
      }
    });
  }
});

// Refresh Dashboard Metrics, Allowlist, and Custom Rules
async function refreshDashboardData() {
  const data = await chrome.storage.local.get(['stats', 'whitelistedDomains', 'customCssRules', 'filterLists']);
  
  // Update Toggles
  const filterLists = data.filterLists || { ads: true, trackers: true, annoyances: true };
  const adsToggle = document.getElementById('toggle-list-ads');
  const trackersToggle = document.getElementById('toggle-list-trackers');
  const annoyancesToggle = document.getElementById('toggle-list-annoyances');
  if (adsToggle) adsToggle.checked = filterLists.ads;
  if (trackersToggle) trackersToggle.checked = filterLists.trackers;
  if (annoyancesToggle) annoyancesToggle.checked = filterLists.annoyances;
  
  // Update Metrics
  const stats = data.stats || { totalBlocked: 0, trackersBlocked: 0, dataSavedMB: 0 };
  document.getElementById('dash-total-blocked').textContent = stats.totalBlocked || 0;
  document.getElementById('dash-trackers-blocked').textContent = stats.trackersBlocked || 0;
  document.getElementById('dash-data-saved').textContent = `${stats.dataSavedMB || 0} MB`;

  // Render Allowlist
  const whitelistedDomains = data.whitelistedDomains || [];
  document.getElementById('allowlist-count').textContent = whitelistedDomains.length;
  const domainListContainer = document.getElementById('domain-list-container');
  domainListContainer.textContent = '';

  if (whitelistedDomains.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.style.cssText = 'color: #94a3b8; font-size: 13px;';
    emptyLi.textContent = 'No whitelisted domains. All sites protected.';
    domainListContainer.appendChild(emptyLi);
  } else {
    whitelistedDomains.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'domain-list-item';

      const span = document.createElement('span');
      span.textContent = `🌐 ${domain}`;

      const btn = document.createElement('button');
      btn.className = 'remove-domain-btn';
      btn.setAttribute('data-domain', domain);
      btn.textContent = '✕';

      li.appendChild(span);
      li.appendChild(btn);
      domainListContainer.appendChild(li);
    });

    // Add remove event listeners
    document.querySelectorAll('.remove-domain-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domainToRemove = e.target.getAttribute('data-domain');
        const { whitelistedDomains: list = [] } = await chrome.storage.local.get('whitelistedDomains');
        const updated = list.filter(d => d !== domainToRemove);
        await chrome.storage.local.set({ whitelistedDomains: updated });
        await chrome.runtime.sendMessage({ action: 'TOGGLE_WHITELIST', domain: domainToRemove });
        await refreshDashboardData();
      });
    });
  }

  // Render Custom Rules
  const customCssRules = data.customCssRules || {};
  const customRulesContainer = document.getElementById('custom-rules-container');
  customRulesContainer.textContent = '';

  const entries = Object.entries(customCssRules);
  if (entries.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.style.cssText = 'color: #94a3b8; font-size: 13px;';
    emptyP.textContent = 'No custom element hiding rules created yet. Use the "Block Element" tool in the popup on any website!';
    customRulesContainer.appendChild(emptyP);
  } else {
    entries.forEach(([domain, selectors]) => {
      selectors.forEach(selector => {
        const card = document.createElement('div');
        card.className = 'custom-rule-card';

        const strong = document.createElement('strong');
        strong.textContent = `Domain: ${domain}`;

        const code = document.createElement('code');
        code.textContent = selector;

        card.appendChild(strong);
        card.appendChild(code);
        customRulesContainer.appendChild(card);
      });
    });
  }

  // Render Subscriptions
  const { subscriptions = [] } = await chrome.storage.local.get('subscriptions');
  const subListContainer = document.getElementById('sub-list-container');
  if (subListContainer) {
    subListContainer.textContent = '';
    if (subscriptions.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.style.cssText = 'color: #94a3b8; font-size: 13px;';
      emptyLi.textContent = 'No active filter subscriptions.';
      subListContainer.appendChild(emptyLi);
    } else {
      subscriptions.forEach(url => {
        const li = document.createElement('li');
        li.className = 'domain-list-item';

        const span = document.createElement('span');
        span.textContent = `📡 ${url}`;

        const btn = document.createElement('button');
        btn.className = 'remove-domain-btn remove-sub-btn';
        btn.setAttribute('data-url', url);
        btn.textContent = '✕';

        li.appendChild(span);
        li.appendChild(btn);
        subListContainer.appendChild(li);
      });

      // Add remove event listeners for subscriptions
      document.querySelectorAll('.remove-sub-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const urlToRemove = e.target.getAttribute('data-url');
          await chrome.runtime.sendMessage({ action: 'REMOVE_SUBSCRIPTION', url: urlToRemove });
          await refreshDashboardData();
        });
      });
    }
  }
}
