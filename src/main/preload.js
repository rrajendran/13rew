const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brewAPI', {
  // Brew commands
  execute: (command, args) => ipcRenderer.invoke('brew:execute', command, args),
  getInfo: () => ipcRenderer.invoke('brew:info'),
  getInstalled: (type) => ipcRenderer.invoke('brew:installed', type),
  getOutdated: () => ipcRenderer.invoke('brew:outdated'),
  search: (query) => ipcRenderer.invoke('brew:search', query),
  getPackageInfo: (packageName) => ipcRenderer.invoke('brew:package-info', packageName),
  install: (packageName, isCask) => ipcRenderer.invoke('brew:install', packageName, isCask),
  uninstall: (packageName) => ipcRenderer.invoke('brew:uninstall', packageName),
  upgrade: (packageName) => ipcRenderer.invoke('brew:upgrade', packageName),
  update: () => ipcRenderer.invoke('brew:update'),
  getLogs: () => ipcRenderer.invoke('brew:logs'),
  getLeaves: () => ipcRenderer.invoke('brew:leaves'),
  
  // Progress listener
  onProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('brew:progress', listener);
    return () => ipcRenderer.removeListener('brew:progress', listener);
  },
  onUpgradeProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('brew:upgrade:progress', listener);
    return () => ipcRenderer.removeListener('brew:upgrade:progress', listener);
  },
  onUpgradeCurrent: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('brew:upgrade:current', listener);
    return () => ipcRenderer.removeListener('brew:upgrade:current', listener);
  },
  
  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  
  // Notifications
  notification: {
    send: (title, body) => ipcRenderer.invoke('notification:send', title, body)
  },
  
  // Updates (auto-updater namespace)
  appUpdate: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:checking', listener);
      return () => ipcRenderer.removeListener('update:checking', listener);
    },
    onAvailable: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:available', listener);
      return () => ipcRenderer.removeListener('update:available', listener);
    },
    onNotAvailable: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:not-available', listener);
      return () => ipcRenderer.removeListener('update:not-available', listener);
    },
    onDownloaded: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:downloaded', listener);
      return () => ipcRenderer.removeListener('update:downloaded', listener);
    },
    onError: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:error', listener);
      return () => ipcRenderer.removeListener('update:error', listener);
    },
    onDownloadProgress: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:download-progress', listener);
      return () => ipcRenderer.removeListener('update:download-progress', listener);
    }
  }
});

// Extended APIs for v2 features
contextBridge.exposeInMainWorld('brewV2', {
  services: {
    list: () => ipcRenderer.invoke('brew:services:list'),
    action: (action, name) => ipcRenderer.invoke('brew:services:action', action, name)
  },
  deps: {
    tree: (formula) => ipcRenderer.invoke('brew:deps:tree', formula),
    graph: (packages) => ipcRenderer.invoke('brew:deps:graph', packages)
  },
  brewfile: {
    export: () => ipcRenderer.invoke('brewfile:export'),
    import: (content, opts) => ipcRenderer.invoke('brewfile:import', content, opts)
  },
  menubar: {
    enable: () => ipcRenderer.invoke('menubar:enable'),
    disable: () => ipcRenderer.invoke('menubar:disable')
  }
});
