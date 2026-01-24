const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');

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

function createWindow() {
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
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Execute brew commands
ipcMain.handle('brew:execute', async (event, command, args = []) => {
  return new Promise((resolve, reject) => {
    const brewPath = store.get('brewPath', detectedBrewPath);
    
    // Check if brew exists
    if (!fs.existsSync(brewPath)) {
      reject({
        success: false,
        output: '',
        error: `Homebrew not found at: ${brewPath}\n\nPlease:\n1. Install Homebrew from https://brew.sh/\n2. Or update the brew path in Settings`,
        code: -1
      });
      return;
    }
    
    const brewProcess = spawn(brewPath, [command, ...args]);
    
    let stdout = '';
    let stderr = '';

    brewProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      // Send progress updates
      mainWindow?.webContents.send('brew:progress', data.toString());
    });

    brewProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    brewProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout, error: stderr });
      } else {
        reject({ success: false, output: stdout, error: stderr, code });
      }
    });
  });
});

// Get brew info
ipcMain.handle('brew:info', async () => {
  try {
    const versionResult = await executeBrewCommand('--version', []);
    const version = versionResult.output.split('\n')[0];
    
    const [formulaeResult, casksResult, outdatedResult] = await Promise.all([
      executeBrewCommand('list', ['--formula']),
      executeBrewCommand('list', ['--cask']),
      executeBrewCommand('outdated', [])
    ]);

    const formulae = formulaeResult.output.split('\n').filter(l => l.trim());
    const casks = casksResult.output.split('\n').filter(l => l.trim());
    const outdated = outdatedResult.output.split('\n').filter(l => l.trim());

    return {
      version,
      formulaeCount: formulae.length,
      casksCount: casks.length,
      outdatedCount: outdated.length,
      lastUpdate: store.get('lastUpdate', null)
    };
  } catch (error) {
    throw error;
  }
});

// Get installed packages
ipcMain.handle('brew:installed', async (event, type = 'all') => {
  try {
    const args = type === 'formula' ? ['--formula'] : type === 'cask' ? ['--cask'] : [];
    const result = await executeBrewCommand('list', args);
    const packages = result.output.split('\n').filter(l => l.trim());
    
    return packages;
  } catch (error) {
    throw error;
  }
});

// Get outdated packages
ipcMain.handle('brew:outdated', async () => {
  try {
    // Prefer JSON v2 output when available
    let result;
    try {
      result = await executeBrewCommand('outdated', ['--json=v2']);
    } catch (e) {
      // Fallback to generic --json or plain output
      try {
        result = await executeBrewCommand('outdated', ['--json']);
      } catch (e2) {
        result = await executeBrewCommand('outdated', []);
      }
    }

    // If plain text was returned (newline-separated names), normalize to simple objects
    const out = result.output && result.output.trim();
    if (!out) return [];

    // Try parse JSON
    try {
      const parsed = JSON.parse(result.output);
      // Homebrew may return an object with keys like {formulae: [...], casks: [...]} 
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        const combined = [];
        if (Array.isArray(parsed.formulae)) combined.push(...parsed.formulae.map(f => ({ ...f, type: 'formula' })));
        if (Array.isArray(parsed.casks)) combined.push(...parsed.casks.map(c => ({ ...c, type: 'cask' })));
        return combined;
      }
    } catch (jsonErr) {
      // Not JSON — assume newline-separated package names
      const lines = result.output.split('\n').map(l => l.trim()).filter(Boolean);
      return lines.map(name => ({ name, installed_versions: [], current_version: null }));
    }
    return [];
  } catch (error) {
    return [];
  }
});

// Brew services handlers
ipcMain.handle('brew:services:list', async () => {
  try {
    const result = await executeBrewCommand('services', ['list']);
    const lines = result.output.split('\n').filter(l => l.trim());
    // Skip header if present
    const headerIndex = lines.findIndex(l => /^Name\s+Status/.test(l));
    const entries = [];
    for (const line of lines) {
      // Try to match columns: Name  Status  User  Plist (status often 'started'|'stopped')
      const m = line.match(/^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.*)$/);
      if (m) {
        entries.push({ name: m[1].trim(), status: m[2].trim(), user: m[3].trim(), plist: (m[4] || '').trim(), raw: line });
      } else {
        // Fallback to splitting by 2+ spaces
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 2) entries.push({ name: parts[0].trim(), status: parts[1].trim(), raw: line });
      }
    }
    return entries;
  } catch (error) {
    return [];
  }
});

ipcMain.handle('brew:services:action', async (event, action, name) => {
  try {
    if (!['start', 'stop', 'restart'].includes(action)) throw new Error('Invalid action');
    const result = await executeBrewCommand('services', [action, name]);
    return { success: true, output: result.output };
  } catch (error) {
    return { success: false, error: error.error || error.message };
  }
});

// Dependency graph helpers
ipcMain.handle('brew:deps:tree', async (event, formula) => {
  try {
    // Use brew deps --tree if available
    const result = await executeBrewCommand('deps', ['--tree', formula]);
    return { success: true, tree: result.output };
  } catch (error) {
    return { success: false, error: error.error || error.message };
  }
});

ipcMain.handle('brew:deps:graph', async (event, packages = []) => {
  try {
    // Build dependency trees by calling `brew deps --tree` for each package
    const trees = [];
    for (const pkg of packages) {
      try {
        const result = await executeBrewCommand('deps', ['--tree', pkg]);
        trees.push({ package: pkg, tree: result.output, success: true });
      } catch (e) {
        trees.push({ package: pkg, tree: '', success: false, error: e.error || e.message });
      }
    }
    return { success: true, trees };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Brewfile export/import
ipcMain.handle('brewfile:export', async () => {
  try {
    const formulaeRes = await executeBrewCommand('list', ['--formula']);
    const casksRes = await executeBrewCommand('list', ['--cask']);
    const formulae = formulaeRes.output.split('\n').filter(Boolean);
    const casks = casksRes.output.split('\n').filter(Boolean);

    const lines = [];
    lines.push('# Brewfile generated by Brew Desktop');
    for (const f of formulae) lines.push(`brew "${f}"`);
    for (const c of casks) lines.push(`cask "${c}"`);

    return { success: true, content: lines.join('\n') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('brewfile:import', async (event, content, { dryRun = true } = {}) => {
  try {
    const lines = (content || '').split('\n').map(l => l.trim()).filter(Boolean);
    const toInstall = [];
    for (const line of lines) {
      // match brew "name" or cask "name"
      const m = line.match(/^(brew|cask)\s+\"([^\"]+)\"/);
      if (m) {
        toInstall.push({ type: m[1], name: m[2] });
      }
    }

    if (dryRun) return { success: true, toInstall };

    const results = [];
    for (const pkg of toInstall) {
      try {
        if (pkg.type === 'cask') {
          await executeBrewCommand('install', ['--cask', pkg.name]);
        } else {
          await executeBrewCommand('install', [pkg.name]);
        }
        results.push({ pkg, success: true });
      } catch (e) {
        results.push({ pkg, success: false, error: e.error || e.message });
      }
    }
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Menubar / Tray support
let appTray = null;
async function updateTray() {
  if (!appTray) return;
  try {
    const info = await (async () => {
      const versionResult = await executeBrewCommand('--version', []);
      const [formulaeResult, casksResult, outdatedResult] = await Promise.all([
        executeBrewCommand('list', ['--formula']),
        executeBrewCommand('list', ['--cask']),
        executeBrewCommand('outdated', [])
      ]);
      const formulae = formulaeResult.output.split('\n').filter(Boolean).length;
      const casks = casksResult.output.split('\n').filter(Boolean).length;
      const outdated = outdatedResult.output.split('\n').filter(Boolean).length;
      return { total: formulae + casks, outdated };
    })();

    const contextMenu = Menu.buildFromTemplate([
      { label: `Packages: ${info.total}`, enabled: false },
      { label: `Outdated: ${info.outdated}`, enabled: false },
      { type: 'separator' },
      { label: 'Open Brew Desktop', click: () => { mainWindow?.show(); } },
      { label: 'Quit', click: () => app.quit() }
    ]);
    appTray.setContextMenu(contextMenu);
    appTray.setToolTip(`Brew Desktop — ${info.total} packages, ${info.outdated} outdated`);
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
    // update periodically
    setInterval(updateTray, 1000 * 60 * 5);
    store.set('menubarEnabled', true);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('menubar:disable', async () => {
  if (!appTray) return true;
  try {
    appTray.destroy();
    appTray = null;
    store.set('menubarEnabled', false);
    return true;
  } catch (e) {
    return false;
  }
});

// Search packages
ipcMain.handle('brew:search', async (event, query) => {
  try {
    const result = await executeBrewCommand('search', [query]);
    return result.output.split('\n').filter(l => l.trim());
  } catch (error) {
    throw error;
  }
});

// Get package info
ipcMain.handle('brew:package-info', async (event, packageName) => {
  try {
    const result = await executeBrewCommand('info', [packageName, '--json']);
    return JSON.parse(result.output)[0];
  } catch (error) {
    throw error;
  }
});

// Install package
ipcMain.handle('brew:install', async (event, packageName, isCask = false) => {
  try {
    const args = isCask ? ['install', '--cask', packageName] : ['install', packageName];
    const result = await executeBrewCommand(args[0], args.slice(1));
    
    // Log the action
    logAction('install', packageName, true);
    
    return result;
  } catch (error) {
    logAction('install', packageName, false, error.error);
    throw error;
  }
});

// Uninstall package
ipcMain.handle('brew:uninstall', async (event, packageName) => {
  try {
    const result = await executeBrewCommand('uninstall', [packageName]);
    logAction('uninstall', packageName, true);
    return result;
  } catch (error) {
    logAction('uninstall', packageName, false, error.error);
    throw error;
  }
});

// Upgrade packages
ipcMain.handle('brew:upgrade', async (event, packageName = null) => {
  console.log(`Starting upgrade for: ${packageName || 'all'}`);
  return new Promise((resolve, reject) => {
    const brewPath = store.get('brewPath', detectedBrewPath);
    if (!fs.existsSync(brewPath)) {
      const err = { success: false, error: `Homebrew not found at: ${brewPath}` };
      logAction('upgrade', packageName || 'all', false, err.error);
      return reject(err);
    }

    const args = packageName ? ['upgrade', packageName] : ['upgrade'];
    const proc = spawn(brewPath, args);
    let stdout = '';
    let stderr = '';
    let activityTimeout;

    const resetTimeout = () => {
      clearTimeout(activityTimeout);
      // Read timeout (in minutes) from settings; default to 10 minutes if missing or invalid
      const timeoutMinutes = Number(store.get('upgradeTimeoutMinutes', 10)) || 10;
      const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
      activityTimeout = setTimeout(() => {
        console.error('Upgrade process timed out due to inactivity. Killing process.');
        proc.kill('SIGKILL'); // Force kill the process
        reject({
          success: false,
          error: 'Upgrade process timed out due to inactivity. It might be stuck waiting for a password. Try running "brew upgrade" in your terminal.',
          code: -1
        });
      }, timeoutMs); // timeout from settings (minutes)
    };

    resetTimeout(); // Initial timeout

    proc.stdout.on('data', (data) => {
      resetTimeout(); // Reset timeout on activity
      const text = data.toString();
      console.log('Upgrade stdout:', text);
      stdout += text;
      mainWindow?.webContents.send('brew:upgrade:progress', { line: text });
      const m = text.match(/^(?:==>\s)?Upgrading\s(.+?)\s/);
      if (m && m[1]) {
        mainWindow?.webContents.send('brew:upgrade:current', { package: m[1].trim() });
      }
    });

    proc.stderr.on('data', (data) => {
      resetTimeout(); // Reset timeout on activity
      const text = data.toString();
      console.error('Upgrade stderr:', text);
      stderr += text;
      mainWindow?.webContents.send('brew:upgrade:progress', { line: text });
    });

    proc.on('close', (code) => {
      clearTimeout(activityTimeout); // Clear timeout on process close
      if (code === 0) {
        logAction('upgrade', packageName || 'all', true);
        resolve({ success: true, output: stdout });
      } else {
        logAction('upgrade', packageName || 'all', false, stderr);
        reject({ success: false, output: stdout, error: stderr, code });
      }
    });
  });
});

// Update brew
ipcMain.handle('brew:update', async () => {
  try {
    const result = await executeBrewCommand('update', []);
    store.set('lastUpdate', new Date().toISOString());
    logAction('update', 'brew', true);
    return result;
  } catch (error) {
    logAction('update', 'brew', false, error.error || error.message || error);
    throw error;
  }
});

// Get logs
ipcMain.handle('brew:logs', async () => {
  return store.get('logs', []);
});

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
 

// Helper functions
async function executeBrewCommand(command, args) {
  return new Promise((resolve, reject) => {
    const brewPath = store.get('brewPath', '/opt/homebrew/bin/brew');
    const brewProcess = spawn(brewPath, [command, ...args]);
    
    let stdout = '';
    let stderr = '';

    brewProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    brewProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    brewProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout, error: stderr });
      } else {
        reject({ success: false, output: stdout, error: stderr, code });
      }
    });
  });
}

function logAction(action, target, success, error = null) {
  const logs = store.get('logs', []);
  logs.unshift({
    timestamp: new Date().toISOString(),
    action,
    target,
    success,
    error
  });
  
  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.pop();
  }
  
  store.set('logs', logs);
}

// Send notification
function sendNotification(title, body) {
  if (Notification.isSupported() && store.get('notifications', true)) {
    new Notification({ title, body }).show();
  }
}

// Notification handler
ipcMain.handle('notification:send', async (event, title, body) => {
  sendNotification(title, body);
  return true;
});
