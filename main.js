const { app, Tray, Menu, BrowserWindow, globalShortcut, clipboard, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const Store = require('electron-store');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');
const { PROVIDERS, ENHANCEMENT_STYLES, enhancePrompt } = require('./providers/index');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  showDashboard();
});

let store = null;
let tray = null;
let dashboardWindow = null;
let isEnhancing = false;
let lastEnhancement = null;
global.currentShortcut = null;
global.undoShortcut = null;

function initStore() {
  store = new Store({
    defaults: {
      apiKeys: {},
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o-mini',
      enhancementStyle: 'expert',
      customPrompt: '',
      autoStart: true,
      windowBounds: { width: 480, height: 640 },
      enhancementHistory: [],
    },
  });
}

function addHistoryEntry(entry) {
  const history = store.get('enhancementHistory') || [];
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entry.timestamp = new Date().toISOString();
  history.unshift(entry);
  if (history.length > 200) history.length = 200;
  store.set('enhancementHistory', history);
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
  } catch (_) {
    // Fallback: create colored square from raw buffer
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const cx = size / 2, cy = size / 2, r = size / 2 - 1;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const inside = dist < r;
        buf[idx] = inside ? 74 : 0;
        buf[idx + 1] = inside ? 144 : 0;
        buf[idx + 2] = inside ? 217 : 0;
        buf[idx + 3] = inside ? 255 : 0;
      }
    }
    const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
    trayIcon = img.resize({ width: 16, height: 16 });
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('Prompt Enhance');
  updateTrayMenu();
  tray.on('click', () => showDashboard());
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => showDashboard(),
    },
    { type: 'separator' },
    {
      label: isEnhancing ? 'Working in progress...' : 'Ready',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  const bounds = store.get('windowBounds');
  dashboardWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    resizable: true,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dashboardWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
  });

  dashboardWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      dashboardWindow.hide();
    }
  });

  dashboardWindow.on('resize', () => {
    try {
      const [w, h] = dashboardWindow.getSize();
      store.set('windowBounds', { width: w, height: h });
    } catch (_) {}
  });
}

function showDashboard() {
  createDashboardWindow();
}

function powerShellSendKeys(keys) {
  const psCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')"`;
  execSync(psCmd, { timeout: 5000, stdio: 'pipe' });
}

async function keyboardChord(...keys) {
  try {
    await keyboard.pressKey(...keys);
    await new Promise(r => setTimeout(r, 100));
    await keyboard.releaseKey(...keys);
  } catch (e) {
    const keyStr = keys.map(k => {
      if (k === Key.LeftControl) return '^';
      if (k === Key.C) return 'c';
      if (k === Key.V) return 'v';
      return '';
    }).join('');
    powerShellSendKeys(`^${keyStr.replace('^', '')}`);
  }
}

async function undoLastEnhancement() {
  if (!lastEnhancement || !lastEnhancement.original) return;
  try {
    const originalClipboard = clipboard.readText();
    clipboard.writeText(lastEnhancement.original);
    await new Promise(r => setTimeout(r, 100));
    await keyboardChord(Key.LeftControl, Key.V);
    await new Promise(r => setTimeout(r, 300));
    clipboard.writeText(originalClipboard);
    try { new Notification({ title: 'Prompt Enhance', body: 'Undone: original text restored.' }).show(); } catch (_) {}
  } catch (_) {}
}

async function enhanceSelectedText() {
  if (isEnhancing) return;
  isEnhancing = true;
  updateTrayMenu();

  try {
    const originalClipboard = clipboard.readText();

    clipboard.writeText('__PROMPT_ENHANCE_MARKER__');
    await keyboardChord(Key.LeftControl, Key.C);
    await new Promise(r => setTimeout(r, 500));

    const selectedText = clipboard.readText();
    if (selectedText === '__PROMPT_ENHANCE_MARKER__' || !selectedText) {
      clipboard.writeText(originalClipboard);
      throw new Error('No text selected. Select text first, then press the shortcut.');
    }
    clipboard.writeText(originalClipboard);

    const provider = store.get('selectedProvider');
    const model = store.get('selectedModel');
    const style = store.get('enhancementStyle');
    const customPrompt = store.get('customPrompt');
    const apiKeys = store.get('apiKeys');
    const apiKey = apiKeys[provider];

    if (!apiKey) {
      throw new Error(`No API key for ${PROVIDERS[provider]?.name || provider}. Add it in Dashboard.`);
    }

    const enhanced = await enhancePrompt(provider, apiKey, model, selectedText, style, customPrompt);

    lastEnhancement = { original: selectedText, enhanced, provider, style, timestamp: Date.now() };
    addHistoryEntry({ original: selectedText, enhanced, provider, style, success: true });

    clipboard.writeText(enhanced);
    await new Promise(r => setTimeout(r, 150));

    await keyboardChord(Key.LeftControl, Key.V);
    await new Promise(r => setTimeout(r, 300));

    clipboard.writeText(originalClipboard);

    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('enhance-complete', { success: true });
    }
  } catch (err) {
    addHistoryEntry({ original: '', enhanced: '', provider: store.get('selectedProvider'), style: store.get('enhancementStyle'), success: false, error: err.message });
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('enhance-complete', { success: false, error: err.message });
    }
    try { new Notification({ title: 'Prompt Enhance', body: err.message }).show(); } catch (_) {}
  } finally {
    isEnhancing = false;
    updateTrayMenu();
  }
}

function registerShortcuts() {
  globalShortcut.unregisterAll();

  // Try Ctrl+Shift+Q first
  const enhanceCandidates = [
    'CommandOrControl+Shift+Q',
    'CommandOrControl+Alt+Q',
    'CommandOrControl+Shift+E',
  ];

  for (const acc of enhanceCandidates) {
    const ok = globalShortcut.register(acc, () => { enhanceSelectedText(); });
    if (ok) { global.currentShortcut = acc; break; }
  }

  // Undo shortcut
  const undoCandidates = ['CommandOrControl+Alt+Z', 'CommandOrControl+Shift+Z'];
  for (const acc of undoCandidates) {
    const ok = globalShortcut.register(acc, () => { undoLastEnhancement(); });
    if (ok) { global.undoShortcut = acc; break; }
  }
}

function setAutoStart(enable) {
  const isDev = !app.isPackaged;
  const runKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  if (enable && !isDev) {
    const target = `"${process.execPath}"`;
    const cmd = `REG ADD "${runKey}" /V "PromptEnhance" /T REG_SZ /D ${target} /F`;
    try { execSync(cmd, { timeout: 5000 }); } catch (e) { console.error('Auto-start error:', e.message); }
  } else if (!enable) {
    const cmd = `REG DELETE "${runKey}" /V "PromptEnhance" /F`;
    try { execSync(cmd, { timeout: 5000 }); } catch (_) {}
  }
  store.set('autoStart', enable);
}

function getAutoStart() {
  return store.get('autoStart', false);
}

ipcMain.handle('get-config', (_event, key) => store.get(key));
ipcMain.handle('set-config', (_event, key, value) => { store.set(key, value); return true; });
ipcMain.handle('get-full-config', () => store ? store.store : {});
ipcMain.handle('reset-config', () => { store.clear(); return true; });
ipcMain.handle('get-providers', () => {
  const sanitized = {};
  for (const [key, p] of Object.entries(PROVIDERS)) {
    sanitized[key] = { name: p.name, models: p.models, defaultModel: p.defaultModel, endpoint: p.endpoint, format: p.format };
  }
  return sanitized;
});
ipcMain.handle('get-enhancement-styles', () => {
  const sanitized = {};
  for (const [key, s] of Object.entries(ENHANCEMENT_STYLES)) {
    sanitized[key] = { label: s.label };
  }
  return sanitized;
});
ipcMain.handle('set-auto-start', (_event, enable) => { setAutoStart(enable); return true; });
ipcMain.handle('get-auto-start', () => getAutoStart());
ipcMain.handle('get-active-shortcut', () => global.currentShortcut || 'CommandOrControl+Shift+Q');
ipcMain.handle('get-undo-shortcut', () => global.undoShortcut || 'CommandOrControl+Alt+Z');
ipcMain.handle('get-history', () => store.get('enhancementHistory') || []);
ipcMain.handle('delete-history-item', (_event, id) => {
  const history = store.get('enhancementHistory') || [];
  store.set('enhancementHistory', history.filter(h => h.id !== id));
  return true;
});
ipcMain.handle('clear-history', () => { store.set('enhancementHistory', []); return true; });
ipcMain.on('minimize-window', () => { if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.minimize(); });
ipcMain.on('close-window', () => { if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.hide(); });

app.whenReady().then(() => {
  initStore();
  createTray();
  registerShortcuts();

  if (store.get('autoStart')) {
    setAutoStart(true);
  }
});

app.on('window-all-closed', (e) => { e.preventDefault(); });

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('activate', () => { showDashboard(); });
