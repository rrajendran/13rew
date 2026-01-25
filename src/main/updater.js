// Auto-update module for 13rew
// Uses electron-updater for reliable update management
// Reference: https://www.electronjs.org/docs/latest/tutorial/updates

const { autoUpdater } = require('electron-updater');
const { app, dialog, Notification } = require('electron');
const log = require('electron-log');

let updateCheckInterval = null;
let mainWindow = null;

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Configure auto-updater with explicit GitHub settings
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'rrajendran',
  repo: '13rew',
  private: false
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

function init({ window }) {
  mainWindow = window;
  
  // Log current app state for debugging
  log.info(`App Info: version=${app.getVersion()}, isPackaged=${app.isPackaged}, platform=${process.platform}`);
  
  // Only enable in production
  if (!app.isPackaged) {
    log.warn('Auto-update disabled in development mode. To test updates:');
    log.warn('1. Build the app: npm run build');
    log.warn('2. Run the built app from Applications folder');
    return;
  }
  
  log.info('Initializing auto-updater');
  
  // Log the current configuration
  const config = autoUpdater.currentAppVersionInfo || {};
  log.info('Auto-updater config:', {
    currentVersion: autoUpdater.currentVersion?.version || app.getVersion(),
    feedURL: autoUpdater.feedURL || 'not set',
    platform: process.platform,
    arch: process.arch
  });
  
  // Check for updates on app start (after 5 seconds to let app settle)
  setTimeout(() => {
    checkForUpdates(false); // Silent check on startup
  }, 5000);
  
  // Check for updates every 6 hours
  updateCheckInterval = setInterval(() => {
    checkForUpdates(false); // Silent periodic checks
  }, 1000 * 60 * 60 * 6);
  
  setupEventHandlers();
}

function setupEventHandlers() {
  // Checking for update
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    sendToRenderer('update:checking', {});
  });
  
  // Update available
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    
    // Notify user that download is starting
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '13rew Update Available',
        body: `Version ${info.version} is being downloaded in the background.`,
        silent: true
      });
      notification.show();
    }
    
    // Send to renderer if window exists
    sendToRenderer('update:available', { version: info.version });
  });
  
  // Update not available
  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available. Current version:', info.version);
    sendToRenderer('update:not-available', { version: info.version });
  });
  
  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    log.info(`Download progress: ${percent}%`);
    
    // Send progress to renderer
    sendToRenderer('update:download-progress', {
      percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });
  
  // Update downloaded - ready to install
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded successfully:', info.version);
    
    // Send to renderer
    sendToRenderer('update:downloaded', { version: info.version });
    
    // Show prominent notification with manual install option
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '13rew Update Ready',
        body: `Version ${info.version} is ready to install. Click to install now.`,
        silent: false
      });
      
      notification.on('click', () => {
        quitAndInstall();
      });
      
      notification.show();
    }
    
    // Show dialog only if window is focused
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
      showUpdateReadyDialog(info.version);
    }
  });
  
  // Error handling
  autoUpdater.on('error', (error) => {
    log.error('Auto-update error:', error);
    
    sendToRenderer('update:error', { message: error.message });
    
    // Only show user-facing errors (not network/config issues)
    if (shouldShowError(error)) {
      if (Notification.isSupported()) {
        new Notification({
          title: '13rew Update Error',
          body: 'Unable to check for updates. Will retry later.',
          silent: true
        }).show();
      }
    }
  });
}

function shouldShowError(error) {
  const message = error.message.toLowerCase();
  // Don't show network or feed errors to user
  if (message.includes('err_updater_') || 
      message.includes('feed') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')) {
    return false;
  }
  return true;
}

function showUpdateReadyDialog(version) {
  const { shell } = require('electron');
  const path = require('path');
  const os = require('os');
  
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${version} has been downloaded`,
    detail: 'The update will be installed when you restart the application. Would you like to restart now?',
    buttons: ['Restart Now', 'Install Manually', 'Later'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });
  
  if (response === 0) {
    // Restart and install
    quitAndInstall();
  } else if (response === 1) {
    // Open cache folder for manual installation
    const cacheDir = path.join(os.homedir(), 'Library', 'Caches', '13rew-updater');
    log.info('Opening cache directory for manual install:', cacheDir);
    shell.openPath(cacheDir).then(() => {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        title: 'Manual Installation',
        message: 'Update files opened in Finder',
        detail: 'Drag the .app file to your Applications folder to complete the update.',
        buttons: ['OK']
      });
    });
  }
}

function checkForUpdates(userInitiated = false) {
  if (!app.isPackaged) {
    log.info('Skipping update check in development');
    if (userInitiated) {
      sendToRenderer('update:not-available', { version: app.getVersion() });
    }
    return;
  }
  
  log.info('Attempting to check for updates from GitHub...');
  try {
    autoUpdater.checkForUpdates().then(result => {
      log.info('checkForUpdates returned:', result);
    }).catch(err => {
      log.error('Update check failed:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      if (userInitiated) {
        sendToRenderer('update:error', { message: err.message });
      }
    });
  } catch (err) {
    log.error('Exception during checkForUpdates:', err);
    if (userInitiated) {
      sendToRenderer('update:error', { message: err.message });
    }
  }
}

function quitAndInstall() {
  log.info('Quitting and installing update...');
  
  // Give user immediate feedback
  if (mainWindow && !mainWindow.isDestroyed()) {
    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Installing Update',
      message: 'The app will now restart to install the update.',
      buttons: ['OK']
    }).then(() => {
      performInstall();
    });
  } else {
    performInstall();
  }
}

function performInstall() {
  log.info('Performing installation...');
  
  // Remove listeners that might prevent quit
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
  }
  
  app.removeAllListeners('window-all-closed');
  
  // Use setImmediate to ensure we're not in the middle of event processing
  setImmediate(() => {
    try {
      // isSilent=false (show dialogs), isForceRunAfter=true (restart after install)
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      log.error('Failed to quit and install:', err);
      
      // If auto-install fails, offer manual installation
      if (mainWindow && !mainWindow.isDestroyed()) {
        const { shell } = require('electron');
        const path = require('path');
        const os = require('os');
        
        const cacheDir = path.join(os.homedir(), 'Library', 'Caches', '13rew-updater');
        dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          title: 'Auto-Install Failed',
          message: 'Unable to automatically install the update',
          detail: 'Opening the download folder. Please drag the app to Applications manually.',
          buttons: ['OK']
        });
        shell.openPath(cacheDir);
      }
    }
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, data);
    } catch (err) {
      log.error('Failed to send to renderer:', err);
    }
  }
}

function dispose() {
  log.info('Disposing auto-updater');
  
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  
  // Remove all listeners
  autoUpdater.removeAllListeners();
}

module.exports = {
  init,
  checkForUpdates,
  quitAndInstall,
  dispose
};
