const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');
// Menubar module (tray + background agent)
const menubar = require('./menubar');
// Auto-updater module
const updater = require('./updater');

const store = new Store();

// Detect brew path on startup
function detectBrewPath() {
  const commonPaths = [
    '/opt/homebrew/bin/brew',  // Apple Silicon
    '/usr/local/bin/brew',     // Intel Mac
    '/home/linuxbrew/.linuxbrew/bin/brew'  // Linux
  ];
  
  // First check if we have a saved path
  const savedPath = store.get('brewPath');
  if (savedPath && fs.existsSync(savedPath)) {
    return savedPath;
  }
  
  // Try common paths
  for (const brewPath of commonPaths) {
    if (fs.existsSync(brewPath)) {
      store.set('brewPath', brewPath);
      return brewPath;
    }
  }
  
  // Try using 'which brew'
  try {
    const result = execSync('which brew', { encoding: 'utf8' }).trim();
    if (result && fs.existsSync(result)) {
      store.set('brewPath', result);
      return result;
    }
  } catch (error) {
    // which command failed
  }
  
  // Default fallback
  return '/opt/homebrew/bin/brew';
}

// Initialize brew path
const detectedBrewPath = detectBrewPath();
console.log('Detected brew path:', detectedBrewPath);

let mainWindow;

function createWindow({ show = true } = {}) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#0D1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // Allow starting hidden when in menubar-only mode
    show
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development (use detached window so Console is interactive)
  if (process.argv.includes('--dev')) {
    try {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (e) {
      // Fallback to default if detach isn't supported
      mainWindow.webContents.openDevTools();
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Restore preferences
  const menubarEnabled = store.get('menubarEnabled', false);
  const menubarOnly = store.get('menubarOnly', false);

  // Apply dock visibility for menubar-only mode
  if (process.platform === 'darwin' && menubarOnly) {
    try { app.dock.hide(); } catch (e) {}
  }

  // Create main window based on mode
  if (menubarOnly) {
    // Start hidden; window will be created on demand from menubar
    mainWindow = null;
  } else {
    createWindow({ show: true });
  }

  // Initialize menubar/tray on macOS (icon should always be available)
  if (process.platform === 'darwin') {
    menubar.init({
      app,
      getMainWindow: () => mainWindow,
      openMainWindow: () => {
        if (!mainWindow) {
          createWindow({ show: true });
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  }
  
  // Initialize auto-updater after window is ready
  setTimeout(() => {
    updater.init({ 
      window: mainWindow || null
    });
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // In menubar-only mode, keep the app hidden until requested
      const menubarOnly = store.get('menubarOnly', false);
      if (!menubarOnly) createWindow({ show: true });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup tray interval
  try {
    if (trayUpdateInterval) {
      clearInterval(trayUpdateInterval);
      trayUpdateInterval = null;
    }
  } catch (e) {}
  // Ensure tray resources are cleaned up
  try { menubar.dispose && menubar.dispose(); } catch (e) {}
  // Cleanup updater
  try { updater.dispose && updater.dispose(); } catch (e) {}
  // Cleanup brew API resources (cache, timers)
  try { brewApiCleanup && brewApiCleanup.cleanup && brewApiCleanup.cleanup(); } catch (e) {}
});

// Brew IPC handlers are registered in a separate module for clarity
const brewApi = require('./brew-api');
const brewApiCleanup = brewApi.init({ ipcMain, store, getMainWindow: () => mainWindow, detectedBrewPath });

// Menubar / Tray support
let appTray = null;
let trayUpdateInterval = null;

// Non-blocking tray update using async spawn
async function updateTray() {
  if (!appTray) return;
  try {
    const brewPath = store.get('brewPath', detectedBrewPath);
    
    // Helper to run brew command asynchronously
    const runAsync = (cmd, args) => {
      return new Promise((resolve) => {
        const proc = spawn(brewPath, [cmd, ...args]);
        const chunks = [];
        
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => chunks.push(data));
        proc.on('close', () => resolve(chunks.join('')));
        proc.on('error', () => resolve(''));
        
        // Timeout after 5 seconds to prevent hanging
        setTimeout(() => {
          try { proc.kill(); } catch (e) {}
          resolve('');
        }, 5000);
      });
    };

    // Run commands in parallel for better performance
    const [formulaeOut, casksOut, outdatedOut] = await Promise.all([
      runAsync('list', ['--formula']),
      runAsync('list', ['--cask']),
      runAsync('outdated', [])
    ]);

    const formulae = (formulaeOut || '').split('\n').filter(Boolean).length;
    const casks = (casksOut || '').split('\n').filter(Boolean).length;
    const outdated = (outdatedOut || '').split('\n').filter(Boolean).length;
    const total = formulae + casks;

    const contextMenu = Menu.buildFromTemplate([
      { label: `Packages: ${total}`, enabled: false },
      { label: `Outdated: ${outdated}`, enabled: false },
      { type: 'separator' },
      { label: 'Open Brew Desktop', click: () => { mainWindow?.show(); } },
      { label: 'Quit', click: () => app.quit() }
    ]);
    appTray.setContextMenu(contextMenu);
    appTray.setToolTip(`Brew Desktop — ${total} packages, ${outdated} outdated`);
  } catch (e) {
    // ignore
  }
}

ipcMain.handle('menubar:enable', async () => {
  if (appTray) return true;
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'mac', 'trayTemplate.png');
    appTray = new Tray(iconPath);
    appTray.on('click', () => {
      mainWindow?.show();
    });
    await updateTray();
    // Clear existing interval to prevent duplicates
    if (trayUpdateInterval) clearInterval(trayUpdateInterval);
    // Update periodically
    trayUpdateInterval = setInterval(updateTray, 1000 * 60 * 5);
    // Use unref to prevent blocking app exit
    if (trayUpdateInterval.unref) trayUpdateInterval.unref();
    store.set('menubarEnabled', true);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('menubar:disable', async () => {
  if (!appTray) return true;
  try {
    // Clear interval first
    if (trayUpdateInterval) {
      clearInterval(trayUpdateInterval);
      trayUpdateInterval = null;
    }
    appTray.destroy();
    appTray = null;
    store.set('menubarEnabled', false);
    return true;
  } catch (e) {
    return false;
  }
});

// brew handlers have been moved to src/main/brew-api.js

// Settings
ipcMain.handle('settings:get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('settings:set', async (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('settings:getAll', async () => {
  return {
    brewPath: store.get('brewPath', detectedBrewPath),
    autoUpdate: store.get('autoUpdate', false),
    notifications: store.get('notifications', true),
    theme: store.get('theme', 'night-drive'),
    safeMode: store.get('safeMode', true),
    sidebarCollapsed: store.get('sidebarCollapsed', false)
    ,
    upgradeTimeoutMinutes: store.get('upgradeTimeoutMinutes', 10)
  };
});
 

// Update handlers
ipcMain.handle('update:check', async () => {
  try {
    updater.checkForUpdates(true); // User-initiated check
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update:install', async () => {
  try {
    updater.quitAndInstall();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
