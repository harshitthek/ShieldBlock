/**
 * ShieldBlock - Live Logger Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('log-table-body');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('log-search');
  const clearBtn = document.getElementById('clear-logs-btn');

  let logs = [];

  // Fetch initial log buffer from background
  try {
    const res = await chrome.runtime.sendMessage({ action: 'GET_LOGS' });
    if (res && res.logs) {
      logs = res.logs;
      renderLogs();
    }
  } catch (e) {
    console.error('Failed to load initial logs', e);
  }

  // Listen for real-time log broadcasts
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'NEW_LOG_ENTRY' && msg.entry) {
      logs.unshift(msg.entry);
      if (logs.length > 200) logs.pop();
      renderLogs();
    }
  });

  // Search filter
  searchInput.addEventListener('input', () => {
    renderLogs();
  });

  // Clear logs button
  clearBtn.addEventListener('click', async () => {
    logs = [];
    await chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
    renderLogs();
  });

  function renderLogs() {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = logs.filter(log => !query || log.url.toLowerCase().includes(query) || log.resourceType?.toLowerCase().includes(query));

    tableBody.textContent = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(log => {
      const tr = document.createElement('tr');

      const tdTime = document.createElement('td');
      tdTime.style.color = '#94a3b8';
      tdTime.textContent = log.timestamp || 'Just now';

      const tdType = document.createElement('td');
      const spanType = document.createElement('span');
      spanType.className = 'type-pill';
      spanType.textContent = log.type || 'request';
      tdType.appendChild(spanType);

      const tdRuleset = document.createElement('td');
      tdRuleset.style.color = '#64748b';
      tdRuleset.textContent = log.rulesetId || 'dynamic';

      const tdRuleId = document.createElement('td');
      tdRuleId.style.color = '#3b82f6';
      tdRuleId.textContent = `#${log.ruleId}`;

      const tdUrl = document.createElement('td');
      const codeUrl = document.createElement('code');
      codeUrl.className = 'url-code';
      codeUrl.textContent = log.url;
      tdUrl.appendChild(codeUrl);

      tr.appendChild(tdTime);
      tr.appendChild(tdType);
      tr.appendChild(tdRuleset);
      tr.appendChild(tdRuleId);
      tr.appendChild(tdUrl);

      tableBody.appendChild(tr);
    });
  }
});
