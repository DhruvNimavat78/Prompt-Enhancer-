const api = window.electronAPI;
let providers = {};
let styles = {};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

function fmtAcc(accel) {
  if (!accel) return 'Ctrl+Shift+Q';
  return accel.split('+').map(p => {
    if (p === 'CommandOrControl') return 'Ctrl';
    if (p === 'LeftControl' || p === 'Control') return 'Ctrl';
    return p;
  }).join('+');
}

async function init() {
  try {
    providers = await api.getProviders();
    styles = await api.getEnhancementStyles();
  } catch (_) { return; }
  const config = await api.getFullConfig().catch(() => ({}));

  // Attach listeners FIRST so change events are handled
  setupListeners();

  // Populate selects (triggers onchange handlers)
  const provSel = $('#providerSelect');
  if (provSel) {
    provSel.innerHTML = Object.entries(providers).map(([k, p]) =>
      `<option value="${k}"${config.selectedProvider === k ? ' selected' : ''}>${esc(p.name)}</option>`
    ).join('');
    provSel.value = config.selectedProvider || 'openai';
    updateModels(provSel.value, config.selectedModel);
  }

  const styleSel = $('#styleSelect');
  if (styleSel) {
    styleSel.innerHTML = Object.entries(styles).map(([k, s]) =>
      `<option value="${k}"${config.enhancementStyle === k ? ' selected' : ''}>${esc(s.label)}</option>`
    ).join('');
    styleSel.value = config.enhancementStyle || 'expert';
    toggleCustom(styleSel.value);
  }

  // Load API key
  const apiKeys = config.apiKeys || {};
  const provider = config.selectedProvider || 'openai';
  const keyInput = $('#apiKeyInput');
  if (keyInput) keyInput.value = apiKeys[provider] || '';
  updateStatus();

  // Auto-start
  const autoCk = $('#autoStartCheck');
  if (autoCk) autoCk.checked = config.autoStart !== undefined ? config.autoStart : await api.getAutoStart().catch(() => false);

  // Shortcuts
  const [enhAccel, undAccel] = await Promise.all([
    api.getActiveShortcut().catch(() => 'Ctrl+Shift+Q'),
    api.getUndoShortcut().catch(() => 'Ctrl+Alt+Z'),
  ]);
  const enhEl = $('#shortcutDisplay');
  const undEl = $('#undoShortcutDisplay');
  if (enhEl) enhEl.textContent = fmtAcc(enhAccel);
  if (undEl) undEl.textContent = fmtAcc(undAccel);

  // History
  loadHistory();
}

function updateModels(providerKey, selectedModel) {
  const mSel = $('#modelSelect');
  const pr = providers[providerKey];
  if (!mSel || !pr) return;
  mSel.innerHTML = (pr.models || []).map(m =>
    `<option value="${esc(m)}">${esc(m)}</option>`
  ).join('');
  const val = (selectedModel && pr.models?.includes(selectedModel)) ? selectedModel : (pr.defaultModel || pr.models?.[0] || '');
  mSel.value = val;
}

function toggleCustom(val) {
  const sec = $('#customSection');
  if (sec) sec.style.display = val === 'custom' ? 'block' : 'none';
}

function setupListeners() {
  // Titlebar
  const minBtn = $('#btnMinimize');
  const clsBtn = $('#btnClose');
  if (minBtn) minBtn.onclick = () => api.minimizeWindow();
  if (clsBtn) clsBtn.onclick = () => api.closeWindow();

  // Tabs
  $$('.tab').forEach(btn => {
    btn.onclick = () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $('#panel-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      if (btn.dataset.tab === 'history') loadHistory();
    };
  });

  // Provider change
  const provSel = $('#providerSelect');
  if (provSel) {
    provSel.onchange = async () => {
      const p = provSel.value;
      const cfg = await api.getFullConfig().catch(() => ({}));
      const keys = cfg.apiKeys || {};
      const keyInp = $('#apiKeyInput');
      if (keyInp) keyInp.value = keys[p] || '';
      updateStatus();
      updateModels(p, cfg.selectedModel);
    };
  }

  // Toggle key
  const togBtn = $('#btnToggleKey');
  if (togBtn) {
    togBtn.onclick = () => {
      const inp = $('#apiKeyInput');
      if (!inp) return;
      if (inp.type === 'password') { inp.type = 'text'; togBtn.textContent = 'Hide'; }
      else { inp.type = 'password'; togBtn.textContent = 'Show'; }
    };
  }

  // Style change
  const styleSel = $('#styleSelect');
  if (styleSel) styleSel.onchange = () => toggleCustom(styleSel.value);

  // History search
  const histSearch = $('#historySearch');
  if (histSearch) histSearch.oninput = () => loadHistory();

  // Clear history
  const clearBtn = $('#btnClearHistory');
  if (clearBtn) clearBtn.onclick = async () => {
    await api.clearHistory();
    loadHistory();
    showToast('History cleared');
  };

  // Save
  const saveBtn = $('#btnSave');
  if (saveBtn) saveBtn.onclick = saveConfig;
}

function updateStatus() {
  const stored = $('#apiKeyInput')?.value || '';
  const dot = $('#statusDot');
  const txt = $('#statusText');
  const prov = $('#providerSelect')?.value || 'openai';
  if (stored && stored.length > 5) {
    if (dot) dot.className = 'dot on';
    if (txt) txt.textContent = `Configured (${providers[prov]?.name || prov})`;
  } else {
    if (dot) dot.className = 'dot off';
    if (txt) txt.textContent = 'Not configured';
  }
}

async function saveConfig() {
  const provider = $('#providerSelect')?.value || 'openai';
  const model = $('#modelSelect')?.value || '';
  const style = $('#styleSelect')?.value || 'expert';
  const customPrompt = $('#customPrompt')?.value || '';
  const apiKey = $('#apiKeyInput')?.value?.trim() || '';
  const autoStart = $('#autoStartCheck')?.checked || false;

  const config = await api.getFullConfig().catch(() => ({}));
  const apiKeys = config.apiKeys || {};
  apiKeys[provider] = apiKey;

  await api.setConfig('apiKeys', apiKeys);
  await api.setConfig('selectedProvider', provider);
  await api.setConfig('selectedModel', model);
  await api.setConfig('enhancementStyle', style);
  await api.setConfig('customPrompt', customPrompt);
  await api.setAutoStart(autoStart);

  updateStatus();
  showToast('Saved');
}

/* History */
async function loadHistory() {
  try {
    const history = await api.getHistory().catch(() => []);
    const filter = ($('#historySearch')?.value || '').toLowerCase();
    const body = $('#historyBody');
    const empty = $('#historyEmpty');
    if (!body || !empty) return;

    const filtered = history.filter(h =>
      (h.original || '').toLowerCase().includes(filter) ||
      (h.enhanced || '').toLowerCase().includes(filter) ||
      (h.provider || '').toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      empty.querySelector('p').textContent = filter ? 'No matches' : 'No enhancements yet';
      empty.style.display = 'block';
      body.querySelectorAll('.h-item').forEach(e => e.remove());
      return;
    }
    empty.style.display = 'none';

    // Remove old items
    body.querySelectorAll('.h-item').forEach(e => e.remove());

    filtered.forEach(h => {
      const div = document.createElement('div');
      div.className = 'h-item';
      div.innerHTML = `
        <div class="h-meta">
          <span class="h-badge provider">${esc(h.provider || '-')}</span>
          <span class="h-badge style">${esc(h.style || '-')}</span>
          <span class="h-badge ${h.success ? 'ok' : 'fail'}">${h.success ? 'OK' : 'FAIL'}</span>
          <span class="h-time">${fmtTime(h.timestamp)}</span>
        </div>
        ${h.original ? `<div class="h-text orig">${esc(h.original)}</div>` : ''}
        ${h.enhanced ? `<div class="h-text enh">${esc(h.enhanced)}</div>` : ''}
        ${h.error ? `<div class="h-err">${esc(h.error)}</div>` : ''}
        <div class="h-acts">
          ${h.enhanced ? `<button class="h-act copy-e">Copy Enhanced</button>` : ''}
          ${h.original ? `<button class="h-act copy-o">Copy Original</button>` : ''}
          <button class="h-del">Delete</button>
        </div>
      `;

      const copyE = div.querySelector('.copy-e');
      const copyO = div.querySelector('.copy-o');
      const delBtn = div.querySelector('.h-del');

      if (copyE) copyE.onclick = () => { navigator.clipboard.writeText(h.enhanced); showToast('Copied'); };
      if (copyO) copyO.onclick = () => { navigator.clipboard.writeText(h.original); showToast('Original copied'); };
      if (delBtn) delBtn.onclick = async () => { await api.deleteHistoryItem(h.id); loadHistory(); };

      body.appendChild(div);
    });
  } catch (_) {}
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* Toast */
let toastTimer;

function showToast(msg, type) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (type === 'error' ? 'bad' : type === 'success' ? 'good' : '');
  clearTimeout(toastTimer);
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* IPC Events */
api.onEnhanceComplete((result) => {
  if (result.notification) return;
  if (result.success) showToast('Enhanced & pasted!');
  else showToast('Error: ' + (result.error || 'unknown'), 'error');
  loadHistory();
});

document.addEventListener('DOMContentLoaded', init);
