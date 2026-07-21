const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  getFullConfig: () => ipcRenderer.invoke('get-full-config'),
  resetConfig: () => ipcRenderer.invoke('reset-config'),

  // Providers
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getEnhancementStyles: () => ipcRenderer.invoke('get-enhancement-styles'),

  // Auto-start
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

  // Shortcuts
  getActiveShortcut: () => ipcRenderer.invoke('get-active-shortcut'),
  getUndoShortcut: () => ipcRenderer.invoke('get-undo-shortcut'),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Window
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Events
  onEnhanceComplete: (callback) => ipcRenderer.on('enhance-complete', (_event, result) => callback(result)),
});
