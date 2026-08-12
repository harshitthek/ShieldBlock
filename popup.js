/**
 * ShieldBlock - Popup Logic Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM References
  const domainNameEl = document.getElementById('domain-name');
  const domainFaviconEl = document.getElementById('domain-favicon');
  const domainStatusPillEl = document.getElementById('domain-status-pill');
  
  const powerSectionEl = document.querySelector('.power-section');
  const powerBtnEl = document.getElementById('power-btn');
  const powerStatusTextEl = document.getElementById('power-status-text');

  const statPageEl = document.getElementById('stat-page');
  const statTotalEl = document.getElementById('stat-total');
  const statSavedEl = document.getElementById('stat-saved');

  const whitelistBtnEl = document.getElementById('whitelist-btn');
  const whitelistBtnTextEl = document.getElementById('whitelist-btn-text');
  const pickerBtnEl = document.getElementById('picker-btn');
  const openOptionsBtnEl = document.getElementById('open-options-btn');

  let currentDomain = '';

  // Load Initial Popup Data
  async function loadPopupState() {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'GET_STATUS' }).catch(() => null);
      if (!status) {
        domainNameEl.textContent = 'Extension Error';
        powerStatusTextEl.textContent = 'Service Unreachable';
        powerSectionEl.classList.add('disabled');
        return;
      }

      currentDomain = status.domain || 'N/A';
      domainNameEl.textContent = currentDomain || 'Extension Page';

      if (currentDomain && currentDomain !== 'N/A') {
        domainFaviconEl.textContent = '🌐';
      }

      // Update Power Shield UI State
      if (!status.enabled) {
        powerSectionEl.classList.add('disabled');
        powerStatusTextEl.textContent = 'Protection Disabled';
        domainStatusPillEl.className = 'status-pill disabled';
        domainStatusPillEl.textContent = 'Disabled';
      } else if (status.isWhitelisted) {
        powerSectionEl.classList.remove('disabled');
        powerStatusTextEl.textContent = 'Protection Paused on Site';
        domainStatusPillEl.className = 'status-pill paused';
        domainStatusPillEl.textContent = 'Whitelisted';
      } else {
        powerSectionEl.classList.remove('disabled');
        powerStatusTextEl.textContent = 'Protection Enabled';
        domainStatusPillEl.className = 'status-pill protected';
        domainStatusPillEl.textContent = 'Active';
      }

      // Whitelist Button Text
      if (status.isWhitelisted) {
        whitelistBtnTextEl.textContent = 'Resume Protection on Site';
      } else {
        whitelistBtnTextEl.textContent = 'Pause on This Site';
      }

      // Statistics
      statPageEl.textContent = status.pageCount || 0;
      statTotalEl.textContent = status.stats ? status.stats.totalBlocked : 0;
      statSavedEl.textContent = status.stats ? `${status.stats.dataSavedMB || 0} MB` : '0 MB';

    } catch (e) {
      console.error('[ShieldBlock Popup Error]', e);
    }
  }

  // Handle Global Power Switch Click
  powerBtnEl.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'TOGGLE_GLOBAL' });
      if (response) {
        loadPopupState();
      }
    } catch (e) {
      console.error('Toggle failed', e);
    }
  });

  // Handle Whitelist / Allowlist Click
  whitelistBtnEl.addEventListener('click', async () => {
    if (!currentDomain || currentDomain === 'N/A') return;
    const response = await chrome.runtime.sendMessage({
      action: 'TOGGLE_WHITELIST',
      domain: currentDomain
    });
    if (response) {
      loadPopupState();
    }
  });

  const zapperBtnEl = document.getElementById('zapper-btn');
  const loggerBtnEl = document.getElementById('logger-btn');

  // Handle Element Picker Click
  pickerBtnEl.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'START_ELEMENT_PICKER', mode: 'permanent' });
    window.close(); // Close popup window so user can interact with web page
  });

  // Handle Element Zapper Click
  if (zapperBtnEl) {
    zapperBtnEl.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'START_ELEMENT_PICKER', mode: 'zap' });
      window.close();
    });
  }

  // Handle Live Logger Click
  if (loggerBtnEl) {
    loggerBtnEl.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('logger.html') });
    });
  }

  // Handle Open Options / Dashboard
  openOptionsBtnEl.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Initial load
  await loadPopupState();
});
