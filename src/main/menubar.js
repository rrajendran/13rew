// Menubar (Tray) support for 13rew — macOS only, main process
// Plain JavaScript, Electron core APIs only

const { Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');

const store = new Store();

let tray = null;
let updateInterval = null;
let spinnerInterval = null;
let context = {
  app: null,
  getMainWindow: () => null,
  openMainWindow: () => {}
};

// Track ongoing operations for loading state
let operationState = {
  updating: false,
  upgrading: false,
  checkingOutdated: false
};

// Cache for outdated count to show in menu
let cachedOutdatedCount = 0;

// Spinner animation frames for loader
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;

function getSpinner() {
  const frame = spinnerFrames[spinnerIndex];
  spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
  return frame;
}

function startSpinnerAnimation() {
  if (spinnerInterval) return;
  spinnerInterval = setInterval(() => {
    if (operationState.updating || operationState.upgrading || operationState.checkingOutdated) {
      updateTrayTooltipAndMenu();
    } else {
      stopSpinnerAnimation();
    }
  }, 100);
}

function stopSpinnerAnimation() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    spinnerIndex = 0;
  }
}

// Create a high-contrast template icon for the status bar.
function createTemplateIcon() {
  const png16 = path.join(__dirname, '..', '..', 'assets', 'icons', 'png', '16x16.png');
  
  // Try to load the actual PNG file without template mode first
  if (fs.existsSync(png16)) {
    let img = nativeImage.createFromPath(png16);
    if (!img.isEmpty()) {
      // Resize to 20x20 for better visibility in menubar
      img = img.resize({ width: 20, height: 20, quality: 'best' });
      // Don't use template mode - use the actual colored icon
      return img;
    }
  }
  
  // Fallback: create a simple solid black square that's guaranteed to be visible
  // 16x16 solid black square PNG
  const solidBlackSquare = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVR42mNk+M9Qz0AEYBxVMwpGMQA5mgEBF5Z6VwAAAABJRU5ErkJggg==';
  const img = nativeImage.createFromDataURL(`data:image/png;base64,${solidBlackSquare}`);
  img.setTemplateImage(true);
  return img;
}

function getBrewPath() {
  // Prefer stored path
  const saved = store.get('brewPath');
  if (saved && fs.existsSync(saved)) return saved;
  const candidates = [
    '/opt/homebrew/bin/brew', // Apple Silicon
    '/usr/local/bin/brew'     // Intel
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return '/opt/homebrew/bin/brew';
}

function runBrew(command, args = [], { onStdout, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const brewPath = store.get('brewPath', getBrewPath());
    if (!fs.existsSync(brewPath)) {
      const err = { success: false, error: `Homebrew not found at: ${brewPath}` };
      reject(err);
      return;
    }
    const proc = spawn(brewPath, [command, ...args]);
    // Use arrays for efficient string accumulation
    const stdoutChunks = [];
    const stderrChunks = [];
    
    // Set encoding upfront
    if (proc.stdout) {
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (d) => {
        stdoutChunks.push(d);
        if (onStdout) onStdout(d);
      });
    }
    
    if (proc.stderr) {
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (d) => {
        stderrChunks.push(d);
        if (onStderr) onStderr(d);
      });
    }
    
    // Cleanup function to remove listeners
    const cleanup = () => {
      if (proc.stdout) proc.stdout.removeAllListeners();
      if (proc.stderr) proc.stderr.removeAllListeners();
      proc.removeAllListeners();
    };
    
    proc.on('error', (err) => {
      cleanup();
      reject({ success: false, error: String(err) });
    });
    
    proc.on('close', (code) => {
      cleanup();
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      if (code === 0) resolve({ success: true, output: stdout });
      else reject({ success: false, output: stdout, error: stderr, code });
    });
  });
}

function notify(title, body) {
  if (Notification.isSupported() && store.get('notifications', true)) {
    try { new Notification({ title, body }).show(); } catch (e) {}
  }
}

async function updateTrayTooltipAndMenu() {
  if (!tray) return;
  try {
    // Get package counts quickly with parallel execution and timeout protection
    const [formulaeRes, casksRes, outdatedRes] = await Promise.race([
      Promise.all([
        runBrew('list', ['--formula']).catch(() => ({ output: '' })),
        runBrew('list', ['--cask']).catch(() => ({ output: '' })),
        runBrew('outdated', []).catch(() => ({ output: '' }))
      ]),
      new Promise((resolve) => setTimeout(() => resolve([{output:''},{output:''},{output:''}]), 10000))
    ]);
    
    // Efficient line counting
    const countLines = (output) => {
      if (!output) return 0;
      let count = 0;
      for (let i = 0; i < output.length; i++) {
        if (output[i] === '\n' && output[i-1] !== '\n') count++;
      }
      return output[output.length - 1] !== '\n' && output.length > 0 ? count + 1 : count;
    };
    
    const total = countLines(formulaeRes.output) + countLines(casksRes.output);
    const outdated = countLines(outdatedRes.output);
    
    // Cache the outdated count
    cachedOutdatedCount = outdated;

    const menubarOnly = store.get('menubarOnly', false);
    const loginSettings = context.app.getLoginItemSettings ? context.app.getLoginItemSettings() : { openAtLogin: false };

    const menu = Menu.buildFromTemplate([
      { label: 'Open 13rew', click: () => context.openMainWindow() },
      { type: 'separator' },
      { 
        label: operationState.updating ? `Brew Update ${getSpinner()}` : 'Brew Update', 
        enabled: !operationState.updating,
        click: () => handleBrewUpdate() 
      },
      { 
        label: operationState.upgrading ? `Upgrade All ${getSpinner()}` : 'Upgrade All', 
        enabled: !operationState.upgrading,
        click: () => handleBrewUpgradeAll() 
      },
      { 
        label: operationState.checkingOutdated ? `Outdated ${getSpinner()}` : `Outdated (${outdated})`, 
        enabled: !operationState.checkingOutdated,
        click: () => handleBrewOutdated() 
      },
      { type: 'separator' },
      {
        label: 'Background Mode',
        type: 'checkbox',
        checked: menubarOnly,
        click: (item) => toggleMenubarOnly(item.checked)
      },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: !!loginSettings.openAtLogin,
        click: (item) => toggleLaunchAtLogin(item.checked)
      },
      { type: 'separator' },
      { label: 'Quit', click: () => context.app.quit() }
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip(`13rew — ${total} packages, ${outdated} outdated`);
  } catch (e) {
    // Best-effort: still provide a basic menu
    const menu = Menu.buildFromTemplate([
      { label: 'Open 13rew', click: () => context.openMainWindow() },
      { type: 'separator' },
      { 
        label: operationState.updating ? `Brew Update ${getSpinner()}` : 'Brew Update', 
        enabled: !operationState.updating,
        click: () => handleBrewUpdate() 
      },
      { 
        label: operationState.upgrading ? `Upgrade All ${getSpinner()}` : 'Upgrade All', 
        enabled: !operationState.upgrading,
        click: () => handleBrewUpgradeAll() 
      },
      { 
        label: operationState.checkingOutdated ? `Outdated ${getSpinner()}` : `Outdated (${cachedOutdatedCount})`, 
        enabled: !operationState.checkingOutdated,
        click: () => handleBrewOutdated() 
      },
      { type: 'separator' },
      { label: 'Quit', click: () => context.app.quit() }
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip('13rew');
  }
}

function toggleMenubarOnly(enabled) {
  store.set('menubarOnly', !!enabled);
  if (process.platform === 'darwin') {
    try {
      if (enabled) {
        context.app.dock && context.app.dock.hide();
        const win = context.getMainWindow();
        if (win) win.hide();
      } else {
        context.app.dock && context.app.dock.show();
        // Reveal window when switching back to dock+menubar to reduce confusion
        context.openMainWindow();
      }
    } catch (e) {}
  }
  updateTrayTooltipAndMenu();
}

function toggleLaunchAtLogin(enabled) {
  try {
    context.app.setLoginItemSettings({
      openAtLogin: !!enabled,
      // If background mode is enabled, open as hidden for a native feel
      openAsHidden: !!store.get('menubarOnly', false)
    });
  } catch (e) {}
  updateTrayTooltipAndMenu();
}

function handleBrewUpdate() {
  if (operationState.updating) return;
  
  operationState.updating = true;
  startSpinnerAnimation();
  updateTrayTooltipAndMenu(); // Show loader
  
  const win = context.getMainWindow();
  runBrew('update', [], {
    onStdout: (line) => {
      try { win && win.webContents.send('brew:progress', line); } catch (_) {}
    },
    onStderr: (line) => {
      try { win && win.webContents.send('brew:progress', line); } catch (_) {}
    }
  })
    .then((res) => {
      store.set('lastUpdate', new Date().toISOString());
      notify('Homebrew Update', 'brew update completed successfully.');
    })
    .catch((err) => {
      notify('Homebrew Update Failed', (err && err.error) || 'Unknown error');
    })
    .finally(() => {
      operationState.updating = false;
      stopSpinnerAnimation();
      updateTrayTooltipAndMenu(); // Refresh menu
    });
}

function handleBrewUpgradeAll() {
  if (operationState.upgrading) return;
  
  operationState.upgrading = true;
  startSpinnerAnimation();
  updateTrayTooltipAndMenu(); // Show loader
  
  const win = context.getMainWindow();
  runBrew('upgrade', [], {
    onStdout: (line) => {
      try { win && win.webContents.send('brew:upgrade:progress', { line }); } catch (_) {}
      // Try to capture current package
      const m = line.match(/^(?:==>\s)?Upgrading\s(.+?)\s/);
      if (m && m[1]) {
        const candidate = m[1].trim();
        // Ignore numeric-only or progress-like matches (e.g., "1" or "1/23")
        // Only emit current package when the candidate looks like a package name
        if (/[A-Za-z]/.test(candidate)) {
          try { win && win.webContents.send('brew:upgrade:current', { package: candidate }); } catch (_) {}
        }
      }
    },
    onStderr: (line) => {
      try { win && win.webContents.send('brew:upgrade:progress', { line }); } catch (_) {}
    }
  })
    .then(() => {
      notify('Homebrew Upgrade', 'brew upgrade completed successfully.');
    })
    .catch((err) => {
      notify('Homebrew Upgrade Failed', (err && err.error) || 'Unknown error');
    })
    .finally(() => {
      operationState.upgrading = false;
      stopSpinnerAnimation();
      updateTrayTooltipAndMenu(); // Refresh menu
    });
}

function handleBrewOutdated() {
  if (operationState.checkingOutdated) return;
  
  operationState.checkingOutdated = true;
  startSpinnerAnimation();
  updateTrayTooltipAndMenu(); // Show loader
  
  runBrew('outdated', [])
    .then((res) => {
      const count = res.output.split('\n').filter(Boolean).length;
      cachedOutdatedCount = count;
      notify('Outdated Packages', `${count} packages are outdated.`);
      const win = context.getMainWindow();
      try { win && win.webContents.send('brew:outdated:list', res.output); } catch (_) {}
    })
    .catch((err) => {
      notify('Outdated Check Failed', (err && err.error) || 'Unknown error');
    })
    .finally(() => {
      operationState.checkingOutdated = false;
      stopSpinnerAnimation();
      updateTrayTooltipAndMenu(); // Refresh menu
    });
}

function init({ app, getMainWindow, openMainWindow }) {
  context.app = app;
  context.getMainWindow = getMainWindow;
  context.openMainWindow = openMainWindow;

  if (process.platform !== 'darwin') {
    // Menubar mode is macOS-only as requested
    return;
  }

  // Create tray icon
  const templateIcon = createTemplateIcon();
  // Always use a native template image to ensure visibility in light/dark modes
  tray = new Tray(templateIcon);
  // Ensure only the icon is shown (no title)

  // On click, show context menu instead of opening window
  // macOS convention: left-click shows menu, right-click also shows menu
  tray.on('click', () => {
    try { tray.popUpContextMenu(); } catch (_) {}
  });
  
  tray.on('right-click', () => {
    try { tray.popUpContextMenu(); } catch (_) {}
  });

  updateTrayTooltipAndMenu();
  // Periodic refresh to keep counts up to date
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(updateTrayTooltipAndMenu, 1000 * 60 * 5);

  // Persist enabled state
  store.set('menubarEnabled', true);
}

function dispose() {
  try { if (updateInterval) clearInterval(updateInterval); } catch (_) {}
  updateInterval = null;
  stopSpinnerAnimation();
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
}

module.exports = {
  init,
  dispose
};
