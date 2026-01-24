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

// Configure auto-updater
autoUpdater.autoDownload = true; // Download automatically when available
autoUpdater.autoInstallOnAppQuit = false; // Let user decide when to install

function init({ window }) {
  mainWindow = window;
  
  // Only enable in production
  if (!app.isPackaged) {
    log.info('Auto-update disabled in development mode');
    return;
  }
  
  log.info('Initializing auto-updater');
  
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
    
    // Show prominent notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: '13rew Update Ready',
        body: `Version ${info.version} is ready to install. Click to restart now.`,
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
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Version ${version} has been downloaded`,
    detail: 'The update will be installed when you restart the application. Would you like to restart now?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  
  if (response === 0) {
    quitAndInstall();
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
  
  autoUpdater.checkForUpdates().catch(err => {
    log.error('Update check failed:', err.message);
    if (userInitiated) {
      sendToRenderer('update:error', { message: err.message });
    }
  });
}

function quitAndInstall() {
  log.info('Quitting and installing update...');
  
  // Remove all event listeners to prevent multiple quit attempts
  autoUpdater.removeAllListeners();
  
  // Close window and install
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    
    // false = don't force close, true = restart after install
    autoUpdater.quitAndInstall(false, true);
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
