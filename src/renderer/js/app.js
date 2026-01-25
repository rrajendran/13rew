// Application State
window.state = window.state || {
  currentView: 'dashboard',
  sidebarCollapsed: false,
  settings: null,
  brewInfo: null,
  loading: false
};

// Cache frequently accessed DOM elements
window.domCache = window.domCache || {
  mainContent: null,
  sidebar: null,
  themeStylesheet: null,
  navItems: null
};

// Initialize app
async function init() {
  console.log('Initializing 13rew...');
  
  // Cache DOM elements
  window.domCache.mainContent = document.getElementById('main-content');
  window.domCache.sidebar = document.getElementById('sidebar');
  window.domCache.themeStylesheet = document.getElementById('theme-stylesheet');
  
  // Load settings
  window.state.settings = await window.brewAPI.settings.getAll();
  window.state.sidebarCollapsed = window.state.settings.sidebarCollapsed || false;
  
  // Apply theme
  applyTheme(window.state.settings.theme || 'night-drive');
  
  // Apply sidebar state
  if (window.state.sidebarCollapsed && window.domCache.sidebar) {
    window.domCache.sidebar.classList.add('collapsed');
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Setup update event listeners
  setupUpdateListeners();
  
  // Load initial view
  await loadView('dashboard');
  
  console.log('13rew initialized');
}

// Setup update event listeners
function setupUpdateListeners() {
  if (!window.brewAPI.update || !window.brewAPI.update.onAvailable) return;
  
  // Listen for checking event
  if (window.brewAPI.update.onChecking) {
    window.brewAPI.update.onChecking(() => {
      console.log('[INFO] Updater: Checking for updates from GitHub...');
    });
  }
  
  // Listen for update events
  window.brewAPI.update.onAvailable((data) => {
    console.log('[INFO] Update available:', data.version);
    showNotification('Update Available', `Version ${data.version} is downloading...`, 'info');
  });
  
  window.brewAPI.update.onNotAvailable((data) => {
    console.log('[INFO] No update available. Current:', data.version);
    showNotification('No Updates', 'You are running the latest version', 'success');
  });
  
  window.brewAPI.update.onDownloaded((data) => {
    console.log('[INFO] Update downloaded:', data.version);
    showNotification('Update Ready', `Version ${data.version} ready to install. Restart to update.`, 'success');
  });
  
  window.brewAPI.update.onError((data) => {
    console.error('[ERROR] Update error:', data.message);
    showNotification('Update Error', data.message || 'Failed to check for updates', 'error');
  });
}

// Setup event listeners
function setupEventListeners() {
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  sidebarToggle.addEventListener('click', toggleSidebar);
  
  // Navigation - cache nav items
  window.domCache.navItems = document.querySelectorAll('.nav-item');
  window.domCache.navItems.forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      await navigateTo(view);
    });
  });
}

// Toggle sidebar
async function toggleSidebar() {
  const sidebar = window.domCache.sidebar || document.getElementById('sidebar');
  window.state.sidebarCollapsed = !window.state.sidebarCollapsed;
  
  if (window.state.sidebarCollapsed) {
    sidebar.classList.add('collapsed');
  } else {
    sidebar.classList.remove('collapsed');
  }
  
  // Save preference
  await window.brewAPI.settings.set('sidebarCollapsed', window.state.sidebarCollapsed);
}

// Navigate to view
async function navigateTo(view) {
  if (window.state.currentView === view) return;
  
  window.state.currentView = view;
  
  // Update active nav item using cached references
  const navItems = window.domCache.navItems || document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.dataset.view === view) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Load view
  await loadView(view);
}

// Load view
async function loadView(view) {
  const mainContent = window.domCache.mainContent || document.getElementById('main-content');
  mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  try {
    let html = '';
    
    switch (view) {
      case 'dashboard':
        html = await renderDashboard();
        break;
      case 'installed':
        html = await renderInstalled();
        break;
      case 'outdated':
        html = await renderOutdated();
        break;
      case 'services':
        html = await renderServices();
        break;
      case 'deps':
        html = await renderDeps();
        break;
      case 'install':
        html = await renderInstall();
        break;
      case 'logs':
        html = await renderLogs();
        break;
      case 'settings':
        html = await renderSettings();
        break;
      default:
        html = '<div class="empty-state"><h2>View not found</h2></div>';
    }
    
    mainContent.innerHTML = html;
    
    // Setup view-specific event listeners
    setupViewListeners(view);
  } catch (error) {
    console.error('Error loading view:', error);
    mainContent.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading View</h2>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

// Apply theme
function applyTheme(theme) {
  console.log('Applying theme:', theme);
  const themeStylesheet = window.domCache.themeStylesheet || document.getElementById('theme-stylesheet');
  if (!themeStylesheet) {
    console.error('Theme stylesheet element not found!');
    return;
  }
  themeStylesheet.href = `styles/themes/${theme}.css`;
  
  // Update state
  if (window.state && window.state.settings) {
    window.state.settings.theme = theme;
  }
  
  console.log('Theme applied successfully:', theme);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

// Show notification
function showNotification(title, message, type = 'info') {
  // Send native notification
  window.brewAPI.notification.send(title, message);
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
}

// Export for use in views
window.app = {
  state: window.state,
  navigateTo,
  loadView,
  applyTheme,
  formatDate,
  showNotification
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
