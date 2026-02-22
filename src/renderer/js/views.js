// Dashboard View
async function renderDashboard() {
  try {
    const info = await window.brewAPI.getInfo();

    return `
      <div class="view-header">
        <h1 class="view-title">Dashboard</h1>
        <p class="view-subtitle">Overview of your Homebrew installation</p>
      </div>
      
      <div class="card-grid">
        <div class="stat-card">
          <div class="stat-value">${info.formulaeCount}</div>
          <div class="stat-label">Formulae Installed</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${info.casksCount}</div>
          <div class="stat-label">Casks Installed</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value" style="color: ${info.outdatedCount > 0 ? "var(--secondary-turbo)" : "var(--accent-highlight)"}">
            ${info.outdatedCount}
          </div>
          <div class="stat-label">Outdated Packages</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value" style="font-size: 16px; color: var(--text-muted);">
            ${window.app.formatDate(info.lastUpdate)}
          </div>
          <div class="stat-label">Last Update</div>
        </div>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px; color: var(--text-primary);">Quick Actions</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="handleUpdate()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2V8M8 2C5.79 2 4 3.79 4 6M8 2C10.21 2 12 3.79 12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M12 10C12 12.21 10.21 14 8 14C5.79 14 4 12.21 4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Update Brew
          </button>
          
          ${
            info.outdatedCount > 0
              ? `
            <button class="btn btn-success" onclick="handleUpgradeAll()">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 12V4M8 4L5 7M8 4L11 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Upgrade All (${info.outdatedCount})
            </button>
          `
              : ""
          }
          
          <button class="btn btn-secondary" onclick="window.app.navigateTo('install')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5V11M5 8H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Install Package
          </button>
        </div>
      </div>
      
      <div class="card" style="margin-top: 24px;">
        <h3 style="margin-bottom: 12px; color: var(--text-primary);">System Information</h3>
        <div style="display: grid; gap: 8px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Homebrew Version:</span>
            <span style="color: var(--text-primary); font-weight: 600;">${info.version}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Total Packages:</span>
            <span style="color: var(--text-primary); font-weight: 600;">${info.formulaeCount + info.casksCount}</span>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Unable to Load Dashboard</h2>
        <p class="empty-state-text">${error.message}</p>
        <p class="empty-state-text" style="margin-top: 8px;">Make sure Homebrew is installed and accessible.</p>
      </div>
    `;
  }
}

// Installed Packages View
async function renderInstalled() {
  try {
    // fetch installed packages and initialize pagination state
    const items = await window.brewAPI.getInstalled("all");
    const pageSize = window.app.state.settings?.pageSize ?? 10;

    // Normalize packages to objects where possible. Do not infer or coerce
    // whether an item is a cask or formula here — the backend provides
    // explicit metadata in `types` when available and the renderer will
    // display based on that. Keep raw available for debugging.
    const normalized = items.map((it) => {
      console.debug("Installed item:", it);
      if (typeof it === "string") {
        return { name: it, types: null, raw: it };
      }

      return {
        name: it.name || it.full_name || String(it),
        types: Array.isArray(it.types) ? it.types : it.type ? [it.type] : null,
        raw: it,
      };
    });

    // store view data in global state for paging/search
    window.app.state.viewData = window.app.state.viewData || {};
    window.app.state.viewData.installed = {
      items: normalized,
      page: 1,
      pageSize: pageSize,
      query: "",
    };

    // render initially using helper
    return renderInstalledPage();
  } catch (error) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading Packages</h2>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

// Helper to render a page of installed packages (reads window.app.state.viewData.installed)
function renderInstalledPage() {
  const data = window.app.state.viewData?.installed;
  if (!data)
    return '<div class="empty-state"><p class="empty-state-text">No data</p></div>';

  const { items, page, pageSize, query } = data;
  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes((query || "").toLowerCase()),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return `
    <div class="view-header">
      <h1 class="view-title">Installed Packages</h1>
      <p class="view-subtitle">${total} package${total !== 1 ? "s" : ""} installed</p>
    </div>

    <div class="search-bar">
      <input type="text" class="input" placeholder="Search installed packages..." id="search-installed" value="${escapeHtml(query || "")}" oninput="handleInstalledSearch(this.value)">
    </div>

    <div class="package-list" id="package-list-installed">
      ${pageItems
        .map(
          (pkg) => `
        <div class="package-item" data-package="${pkg.name}">
          <div class="package-info">
            <div class="package-name">${pkg.name} <span class="badge badge-info" style="margin-left:8px;">${escapeHtml(pkg.types ? (pkg.types.length === 1 ? pkg.types[0] : pkg.types.join(",")) : (pkg.type || "unknown"))}</span></div>
            <div class="package-version">Click for details</div>
          </div>
          <div class="package-actions">
            <button class="btn btn-secondary" onclick="handlePackageInfo('${pkg.name}')">Info</button>
            <button class="btn btn-danger" onclick="handleUninstall('${pkg.name}')">Uninstall</button>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>

    ${renderPaginationControls("installed", total, pageSize, page)}
  `;
}

// Outdated Packages View
async function renderOutdated() {
  try {
    const items = await window.brewAPI.getOutdated();
    const pageSize = window.app.state.settings?.pageSize ?? 10;

    const normalized = (items || []).map((it) => {
      const name = it.name || it.full_name || it;
      const installed_versions = it.installed_versions || it.installed || [];
      const current_version = it.current_version || it.current || null;

      // Attempt to derive the available (new) version from multiple possible fields
      let latest_version = null;
      if (it.latest_version) latest_version = it.latest_version;
      else if (it.new_version) latest_version = it.new_version;
      else if (
        it.newer_versions &&
        Array.isArray(it.newer_versions) &&
        it.newer_versions.length
      )
        latest_version = it.newer_versions[0];
      else if (it.versions && (it.versions.stable || it.versions.current))
        latest_version = it.versions.stable || it.versions.current;
      else if (it.version) latest_version = it.version;
      else if (
        it.current_version &&
        (!installed_versions || installed_versions.length === 0)
      )
        latest_version = it.current_version;

      return {
        name,
        installed_versions,
        current_version,
        latest_version,
        type: it.type || (it.cask ? "cask" : "formula"),
      };
    });

    window.app.state.viewData = window.app.state.viewData || {};
    window.app.state.viewData.outdated = {
      items: normalized,
      page: 1,
      pageSize: pageSize,
      query: "",
    };

    return renderOutdatedPage();
  } catch (error) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading Outdated Packages</h2>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

// Services View
async function renderServices() {
  try {
    const services = await window.brewV2.services.list();
    if (!services || services.length === 0) {
      return `
        <div class="view-header">
          <h1 class="view-title">Services</h1>
          <p class="view-subtitle">No services found</p>
        </div>
        <div class="empty-state">
          <p class="empty-state-text">No Homebrew services discovered</p>
        </div>
      `;
    }

    return `
    <div class="view-header">
      <h1 class="view-title">Services</h1>
      <p class="view-subtitle">Manage Homebrew services (start/stop/restart)</p>
    </div>

    <div class="package-list">
      ${services
        .map(
          (s) => `
        <div class="package-item" data-service-name="${escapeHtml(s.name)}">
          <div class="package-info">
            <div class="package-name">${escapeHtml(s.name)} <span class="badge ${s.status === "started" ? "badge-success" : "badge-info"}" style="margin-left:8px;">${escapeHtml(s.status)}</span></div>
            <div class="package-version">${escapeHtml(s.plist || s.raw)}</div>
          </div>
          <div class="package-actions">
            <button class="btn btn-secondary" onclick="handleServiceAction('start','${escapeHtml(s.name)}')">Start</button>
            <button class="btn btn-secondary" onclick="handleServiceAction('stop','${escapeHtml(s.name)}')">Stop</button>
            <button class="btn btn-primary" onclick="handleServiceAction('restart','${escapeHtml(s.name)}')">Restart</button>
            <button class="btn btn-secondary" onclick="handleShowServiceDetail('${escapeHtml(s.name)}')">Details</button>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
    `;
  } catch (e) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading Services</h2>
        <p class="empty-state-text">${e.message || e}</p>
      </div>
    `;
  }
}

// Dependency Graph View
async function renderDeps() {
  return `
    <div class="view-header">
      <h1 class="view-title">Dependency Graph</h1>
      <p class="view-subtitle">Visualize package dependencies</p>
    </div>

    <div class="card">
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:8px; color:var(--text-muted);">Packages (comma separated)</label>
        <input class="input" id="deps-input" placeholder="e.g. node, wget, git" list="installed-packages-list" onkeydown="if(event.key==='Enter') handleGenerateGraph()" />
        <datalist id="installed-packages-list"></datalist>
      </div>
      <div>
        <button class="btn btn-primary" onclick="handleGenerateGraph()">Generate Graph</button>
      </div>
    </div>

    <div id="deps-output" style="margin-top:16px;"></div>
  `;
}

function renderOutdatedPage() {
  const data = window.app.state.viewData?.outdated;
  if (!data)
    return '<div class="empty-state"><p class="empty-state-text">No data</p></div>';

  const { items, page, pageSize, query } = data;
  
  // Optimize filtering with cached query lowercase
  const queryLower = (query || '').toLowerCase();
  const filtered = queryLower ? items.filter(i => i.name.toLowerCase().includes(queryLower)) : items;
  
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  if (total === 0) {
    return `
      <div class="view-header">
        <h1 class="view-title">Outdated Packages</h1>
        <p class="view-subtitle">All packages are up to date</p>
      </div>
      <div class="empty-state">
        <h2 class="empty-state-title">✓ Everything is Up to Date</h2>
        <p class="empty-state-text">All your packages are running the latest versions</p>
      </div>
    `;
  }

  return `
    <div class="view-header">
      <h1 class="view-title">Outdated Packages</h1>
      <p class="view-subtitle">${total} package${total !== 1 ? "s" : ""} need updating</p>
    </div>

    <div class="search-bar">
      <input type="text" class="input" placeholder="Search outdated packages..." id="search-outdated" value="${escapeHtml(query || "")}" oninput="handleOutdatedSearch(this.value)">
    </div>

    <div style="margin-bottom: 24px;">
      <button class="btn btn-success" onclick="handleUpgradeAll()">
        Upgrade All Packages
      </button>
    </div>

    <div class="package-list">
      ${pageItems
        .map(
          (pkg) => `
        <div class="package-item">
          <div class="package-info">
            <div class="package-name">${pkg.name} <span class="badge badge-warning" style="margin-left:8px;">${escapeHtml(pkg.type || "formula")}</span></div>
            <div class="package-version">${pkg.installed_versions?.[0] || "Unknown"} → ${pkg.current_version || "Unknown"}</div>
          </div>
          <div class="package-actions">
            <button class="btn btn-success" onclick="handleUpgrade('${pkg.name}')">Upgrade</button>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>

    ${renderPaginationControls("outdated", total, pageSize, page)}
  `;
}

// Install/Discover View
async function renderInstall() {
  const pageSize = window.app.state.settings?.pageSize ?? 10;

  window.app.state.viewData = window.app.state.viewData || {};
  window.app.state.viewData.install = {
    items: [],
    page: 1,
    pageSize: pageSize,
    query: "",
  };

  return renderInstallPage();
}

function renderInstallPage() {
  const data = window.app.state.viewData?.install;
  const items = data?.items || [];
  const page = data?.page || 1;
  const pageSize = data?.pageSize || 20;
  const query = data?.query || "";

  const total = items.length;
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return `
    <div class="view-header">
      <h1 class="view-title">Install Packages</h1>
      <p class="view-subtitle">Search and install from Homebrew registry</p>
    </div>
    
    <div class="search-bar">
      <input type="text" class="input" placeholder="Search for packages... (e.g., wget, node, docker)" id="search-packages" value="${escapeHtml(query)}" oninput="handleInstallSearch(this.value)">
    </div>
    
    <div id="search-results" class="package-list" style="margin-top: 24px;">
      ${
        total === 0
          ? `
        <div class="empty-state">
          <p class="empty-state-text">Enter a package name to search</p>
        </div>
      `
          : pageItems
              .map((pkg) => {
                const isCask = String(pkg).includes("/");
                const name =
                  typeof pkg === "string"
                    ? pkg
                    : pkg.name || pkg.full_name || String(pkg);
                return `
          <div class="package-item">
            <div class="package-info">
              <div class="package-name">${escapeHtml(name)} ${isCask ? '<span class="badge badge-info">CASK</span>' : '<span class="badge badge-success">FORMULA</span>'}</div>
              <div class="package-version">Click install to add this package</div>
            </div>
            <div class="package-actions">
              <button class="btn btn-primary" onclick="handleInstall('${escapeHtml(name)}', ${isCask})">Install</button>
            </div>
          </div>
        `;
              })
              .join("")
      }
    </div>

    ${renderPaginationControls("install", total, pageSize, page)}
  `;
}

// Logs View
async function renderLeaves() {
  try {
    const result = await window.brewAPI.getLeaves();
    const packages = (result && result.packages) || [];

    if (!packages.length) {
      return `
        <div class="view-header">
          <h1 class="view-title">Leaves</h1>
          <p class="view-subtitle">Top-level packages with no dependents</p>
        </div>
        <div class="empty-state">
          <h2 class="empty-state-title">No Leaf Packages</h2>
          <p class="empty-state-text">All installed packages are dependencies of another package.</p>
        </div>
      `;
    }

    const rows = packages.map(name => `
      <div class="package-item">
        <div class="package-info">
          <div class="package-name">${escapeHtml(name)}</div>
          <div class="package-version">leaf</div>
        </div>
        <div class="package-actions">
          <button class="btn btn-secondary" onclick="handlePackageInfo('${escapeHtml(name)}')">Info</button>
          <button class="btn btn-secondary" onclick="handleUpgrade('${escapeHtml(name)}')">Upgrade</button>
          <button class="btn btn-danger" onclick="handleUninstall('${escapeHtml(name)}')">Uninstall</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="view-header">
        <h1 class="view-title">Leaves</h1>
        <p class="view-subtitle">${packages.length} top-level package${packages.length !== 1 ? 's' : ''} with no dependents</p>
      </div>
      <div class="package-list">
        ${rows}
      </div>
    `;
  } catch (error) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading Leaves</h2>
        <p class="empty-state-text">${error.message || String(error)}</p>
      </div>
    `;
  }
}

async function renderLogs() {
  try {
    const logs = await window.brewAPI.getLogs();
    const pageSize = window.app.state.settings?.pageSize ?? 10;

    // Store logs in view data for pagination and search
    window.app.state.viewData = window.app.state.viewData || {};
    window.app.state.viewData.logs = {
      items: logs,
      page: 1,
      pageSize: pageSize,
      query: "",
    };

    return renderLogsPage();
  } catch (error) {
    return `
      <div class="empty-state">
        <h2 class="empty-state-title">Error Loading Logs</h2>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

function renderLogsPage() {
  const data = window.app.state.viewData?.logs;
  if (!data)
    return '<div class="empty-state"><p class="empty-state-text">No data</p></div>';

  const { items, page, pageSize, query } = data;

  // Filter logs by action or target
  const filtered = items.filter((log) => {
    const searchTerm = (query || "").toLowerCase();
    if (!searchTerm) return true;
    const action = (log.action || "").toLowerCase();
    const target = (log.target || "").toLowerCase();
    return action.includes(searchTerm) || target.includes(searchTerm);
  });
  const total = filtered.length;

  if (items.length === 0) {
    return `
      <div class="view-header">
        <h1 class="view-title">Logs</h1>
        <p class="view-subtitle">Command history and activity</p>
      </div>
      <div class="empty-state">
        <h2 class="empty-state-title">No Logs Yet</h2>
        <p class="empty-state-text">Activity will appear here once you start using Brew Manager</p>
      </div>
    `;
  }

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return `
    <div class="view-header">
      <h1 class="view-title">Logs</h1>
      <p class="view-subtitle">${total} recent activit${total !== 1 ? "ies" : "y"}</p>
    </div>
    
    <div class="search-bar">
      <input type="text" class="input" placeholder="Search logs by action or package..." id="search-logs" value="${escapeHtml(query || "")}" oninput="handleLogsSearch(this.value)">
    </div>
    
    <div class="package-list" id="package-list-logs">
      ${pageItems
        .map(
          (log) => `
        <div class="package-item">
          <div class="package-info">
            <div class="package-name">
              <span class="badge ${log.success ? "badge-success" : "badge-error"}">
                ${log.success ? "✓" : "✗"}
              </span>
              ${log.action} ${log.target}
            </div>
            <div class="package-version">${window.app.formatDate(log.timestamp)}</div>
          </div>
          ${
            log.error
              ? `
            <button class="btn btn-secondary" onclick="showLogError('${escapeHtml(typeof log.error === 'string' ? log.error : JSON.stringify(log.error, Object.getOwnPropertyNames(log.error || {}), 2)).replace(/\n/g, '\\n')}')">
              View Error
            </button>
          `
              : ""
          }
        </div>
      `,
        )
        .join("")}
    </div>
    
    ${renderPaginationControls("logs", total, pageSize, page)}
  `;
}

// Settings View
async function renderSettings() {
  const settings = await window.brewAPI.settings.getAll();

  return `
    <div class="view-header">
      <h1 class="view-title">Settings</h1>
      <p class="view-subtitle">Configure 13rew</p>
    </div>
    
    <div class="card">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">Appearance</h3>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-muted); font-size: 14px;">
          Theme
        </label>
        <select class="input" id="theme-select" style="width: 300px;">
          <option value="night-drive" ${settings.theme === "night-drive" ? "selected" : ""}>Night Drive (Dark)</option>
          <option value="overdrive" ${settings.theme === "overdrive" ? "selected" : ""}>Overdrive (Dark Purple)</option>
          <option value="steady-cruise" ${settings.theme === "steady-cruise" ? "selected" : ""}>Steady Cruise (Light)</option>
        </select>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">Table configuration</h3>
      <div style="margin-bottom: 8px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-muted); font-size: 14px;">Items per page</label>
        <select class="input" id="page-size-select" style="width: 300px;">
          <option value="10" ${(settings.pageSize ?? 10) === 10 ? "selected" : ""}>10</option>
          <option value="15" ${settings.pageSize === 15 ? "selected" : ""}>15</option>
          <option value="20" ${settings.pageSize === 20 ? "selected" : ""}>20</option>
          <option value="50" ${settings.pageSize === 50 ? "selected" : ""}>50</option>
          <option value="9999" ${settings.pageSize === 9999 ? "selected" : ""}>All</option>
        </select>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Number of items to display per page in lists. Default: 10</p>
      </div>
    </div>
    
    <div class="card" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">Homebrew Configuration</h3>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-muted); font-size: 14px;">
          Brew Binary Path
        </label>
        <input type="text" class="input" id="brew-path" value="${settings.brewPath}" style="width: 300px;">
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          Default: /opt/homebrew/bin/brew (Apple Silicon) or /usr/local/bin/brew (Intel)
        </p>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
          <input type="checkbox" id="auto-update" ${settings.autoUpdate ? "checked" : ""}>
          <span style="color: var(--text-primary);">Auto-update brew on launch</span>
        </label>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
          <input type="checkbox" id="notifications" ${settings.notifications ? "checked" : ""}>
          <span style="color: var(--text-primary);">Enable notifications</span>
        </label>
      </div>
      
      <div>
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
          <input type="checkbox" id="safe-mode" ${settings.safeMode ? "checked" : ""}>
          <span style="color: var(--text-primary);">Safe mode (always confirm actions)</span>
        </label>
      </div>
      
    </div>

    <div class="card" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">Others</h3>
      <div style="margin-top:4px; margin-bottom: 24px;">
        <label style="display:block; margin-bottom:8px; color: var(--text-muted); font-size:14px;">Upgrade timeout (minutes)</label>
        <input type="number" class="input" id="upgrade-timeout" min="1" value="${settings.upgradeTimeoutMinutes ?? 10}" style="width: 300px;">
        <p style="font-size:12px; color: var(--text-muted); margin-top:4px;">How many minutes to wait for activity before cancelling a stuck upgrade. Default: 10</p>
      </div>
      <div style="margin-top:4px;">
        <label style="display:block; margin-bottom:8px; color: var(--text-muted); font-size:14px;">Log retention (days)</label>
        <input type="number" class="input" id="log-retention" min="1" value="${settings.logRetentionDays ?? 30}" style="width: 300px;">
        <p style="font-size:12px; color: var(--text-muted); margin-top:4px;">How many days to keep logs before deleting them. Default: 30</p>
      </div>
    </div>
    
    <div class="card" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">About</h3>
      <div style="display:flex; gap:16px; align-items:center;">
        <img src="../../assets/icons/png/512x512.png" alt="13rew" style="width:64px; height:64px; object-fit:contain;"/>
        <div style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">
          <strong style="color: var(--text-primary);">Brew Manager v0.1.0</strong><br>
          A modern, native-feeling GUI for Homebrew<br>
          <br>
          Built with Electron, designed for macOS
        </div>
      </div>
      <div style="margin-top: 16px;">
        <button class="btn btn-secondary" id="check-updates-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 8px;">
            <path d="M8 2v6m0 0l3-3m-3 3L5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M14 10v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Check for Updates
        </button>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; color: var(--text-primary);">Support me</h3>
      <div style="display:flex; gap:16px; align-items:center;">
        <img src="../../assets/bmc-brand-logo/bmc-brand-icon.svg" alt="Company Logo" style="width:64px; height:64px; object-fit:contain;"/>
        <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
          <a href="#" onclick="event.preventDefault(); window.open('https://buymeacoffee.com/ramesh.rajendran');" class="btn btn-primary">Buy Me a Coffee</a>
          <span style="color: var(--text-muted); font-size: 13px;">Support the project</span>
        </div>
      </div>
    </div>
  `;
}

// Setup view-specific event listeners
async function setupViewListeners(view) {
  // installed view uses inline `oninput` to trigger handleInstalledSearch
  if (view === "installed") {
    // nothing to wire here; handlers are attached inline to inputs
  }

  // Settings view - attach event listeners
  if (view === "settings") {
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
      themeSelect.addEventListener("change", (e) => {
        window.handleThemeChange(e.target.value);
      });
    }
    
    const pageSizeSelect = document.getElementById("page-size-select");
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", (e) => {
        window.handleSettingChange("pageSize", Number(e.target.value));
      });
    }
    
    const brewPathInput = document.getElementById("brew-path");
    if (brewPathInput) {
      brewPathInput.addEventListener("change", (e) => {
        window.handleSettingChange("brewPath", e.target.value);
      });
    }
    
    const autoUpdateCheck = document.getElementById("auto-update");
    if (autoUpdateCheck) {
      autoUpdateCheck.addEventListener("change", (e) => {
        window.handleSettingChange("autoUpdate", e.target.checked);
      });
    }
    
    const notificationsCheck = document.getElementById("notifications");
    if (notificationsCheck) {
      notificationsCheck.addEventListener("change", (e) => {
        window.handleSettingChange("notifications", e.target.checked);
      });
    }
    
    const safeModeCheck = document.getElementById("safe-mode");
    if (safeModeCheck) {
      safeModeCheck.addEventListener("change", (e) => {
        window.handleSettingChange("safeMode", e.target.checked);
      });
    }
    
    const upgradeTimeoutInput = document.getElementById("upgrade-timeout");
    if (upgradeTimeoutInput) {
      upgradeTimeoutInput.addEventListener("change", (e) => {
        window.handleSettingChange("upgradeTimeoutMinutes", Number(e.target.value));
      });
    }
    
    const logRetentionInput = document.getElementById("log-retention");
    if (logRetentionInput) {
      logRetentionInput.addEventListener("change", (e) => {
        window.handleSettingChange("logRetentionDays", Number(e.target.value));
      });
    }
    
    const checkUpdatesBtn = document.getElementById("check-updates-btn");
    if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener("click", async () => {
        checkUpdatesBtn.disabled = true;
        checkUpdatesBtn.textContent = "Checking...";
        
        try {
          await window.brewAPI.appUpdate.check();
          window.app.showNotification("Update Check", "Checking for updates...", "info");
        } catch (error) {
          window.app.showNotification("Update Error", "Failed to check for updates", "error");
        } finally {
          setTimeout(() => {
            checkUpdatesBtn.disabled = false;
            checkUpdatesBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 8px;">
                <path d="M8 2v6m0 0l3-3m-3 3L5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M14 10v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Check for Updates
            `;
          }, 2000);
        }
      });
    }
  }

  // install view uses inline `oninput` -> handleInstallSearch which debounces and calls handleSearch
  // dependency graph view: populate installed package suggestions
  if (view === "deps") {
    try {
      const datalist = document.getElementById("installed-packages-list");
      if (!datalist) return;
      datalist.innerHTML = "";
      const installed = await window.brewAPI.getInstalled("all");
      const names = (installed || [])
        .map((it) =>
          typeof it === "string" ? it : it.name || it.full_name || String(it),
        )
        .filter(Boolean);
      // dedupe
      const uniq = Array.from(new Set(names));
      for (const n of uniq) {
        const opt = document.createElement("option");
        opt.value = n;
        datalist.appendChild(opt);
      }
      // focus input for quick typing
      const inp = document.getElementById("deps-input");
      if (inp) inp.focus();
    } catch (e) {
      // ignore
    }
  }
}

// --- Pagination & helpers ---
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPaginationControls(viewKey, totalItems, pageSize, currentPage) {
  // If pageSize is 9999 (All), don't show pagination
  if (pageSize >= 9999 || totalItems <= pageSize) return "";

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) pages.push(p);

  return `
    <div class="pagination" data-view="${viewKey}">
      <button class="btn btn-secondary" onclick="goToPage('${viewKey}', 1)" ${currentPage === 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11 12L7 8L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 12L3 8L7 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="btn btn-secondary" onclick="goToPage('${viewKey}', ${Math.max(1, currentPage - 1)})" ${currentPage === 1 ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      ${pages
        .map(
          (p) => `
        <button class="btn ${p === currentPage ? "btn-primary" : "btn-secondary"}" onclick="goToPage('${viewKey}', ${p})">${p}</button>
      `,
        )
        .join("")}
      <button class="btn btn-secondary" onclick="goToPage('${viewKey}', ${Math.min(totalPages, currentPage + 1)})" ${currentPage === totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="btn btn-secondary" onclick="goToPage('${viewKey}', ${totalPages})" ${currentPage === totalPages ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 4L9 8L5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;
}

// Global handlers for search
window.handleLogsSearch = function (value) {
  window.app.state.viewData = window.app.state.viewData || {};
  const vd = window.app.state.viewData.logs;
  if (!vd) return;
  vd.query = value || "";
  vd.page = 1;

  // Update only the package list and pagination to avoid losing focus
  const { items, page, pageSize, query } = vd;
  
  const filtered = items.filter((log) => {
    const searchTerm = (query || "").toLowerCase();
    if (!searchTerm) return true;
    const action = (log.action || "").toLowerCase();
    const target = (log.target || "").toLowerCase();
    return action.includes(searchTerm) || target.includes(searchTerm);
  });
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const listContainer = document.getElementById("package-list-logs");
  if (listContainer) {
    listContainer.innerHTML = pageItems
      .map(
        (log) => `
      <div class="package-item">
        <div class="package-info">
          <div class="package-name">
            <span class="badge ${log.success ? "badge-success" : "badge-error"}">
              ${log.success ? "✓" : "✗"}
            </span>
            ${log.action} ${log.target}
          </div>
          <div class="package-version">${window.app.formatDate(log.timestamp)}</div>
        </div>
        ${
          log.error
            ? `
          <button class="btn btn-secondary" onclick="showLogError('${escapeHtml(typeof log.error === 'string' ? log.error : JSON.stringify(log.error, Object.getOwnPropertyNames(log.error || {}), 2)).replace(/\n/g, '\\n')}')">
            View Error
          </button>
        `
            : ""
        }
      </div>
    `,
      )
      .join("");
  }

  // Update pagination
  const paginationContainer = document.querySelector(
    '.pagination[data-view="logs"]',
  );
  if (paginationContainer) {
    const paginationHTML = renderPaginationControls(
      "logs",
      total,
      pageSize,
      page,
    );
    if (paginationHTML) {
      paginationContainer.outerHTML = paginationHTML;
    } else {
      paginationContainer.remove();
    }
  } else if (total > pageSize) {
    // Add pagination if it doesn't exist and we need it
    const mainContent = document.getElementById("main-content");
    const paginationHTML = renderPaginationControls(
      "logs",
      total,
      pageSize,
      page,
    );
    if (mainContent && paginationHTML) {
      mainContent.insertAdjacentHTML("beforeend", paginationHTML);
    }
  }

  // Update subtitle
  const subtitle = document.querySelector(".view-subtitle");
  if (subtitle) {
    subtitle.textContent = `${total} recent activit${total !== 1 ? "ies" : "y"}`;
  }
};

window.handleOutdatedSearch = function (value) {
  window.app.state.viewData = window.app.state.viewData || {};
  const vd = window.app.state.viewData.outdated;
  if (!vd) return;
  vd.query = value || "";
  vd.page = 1;

  // Update only the package list and pagination to avoid losing focus
  const { items, page, pageSize, query } = vd;
  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes((query || "").toLowerCase()),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const listContainer = document.querySelector("#main-content .package-list");
  if (listContainer) {
    listContainer.innerHTML = pageItems
      .map(
        (pkg) => `
      <div class="package-item">
        <div class="package-info">
          <div class="package-name">${pkg.name} <span class="badge badge-warning" style="margin-left:8px;">${escapeHtml(pkg.type || "formula")}</span></div>
          <div class="package-version">${pkg.installed_versions?.[0] || "Unknown"} → ${pkg.current_version || "Unknown"}</div>
        </div>
        <div class="package-actions">
          <button class="btn btn-success" onclick="handleUpgrade('${pkg.name}')">Upgrade</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // Update pagination
  const paginationContainer = document.querySelector(
    '.pagination[data-view="outdated"]',
  );
  if (paginationContainer) {
    const paginationHTML = renderPaginationControls(
      "outdated",
      total,
      pageSize,
      page,
    );
    if (paginationHTML) {
      paginationContainer.outerHTML = paginationHTML;
    } else {
      paginationContainer.remove();
    }
  } else if (total > pageSize) {
    // Add pagination if it doesn't exist and we need it
    const mainContent = document.getElementById("main-content");
    const paginationHTML = renderPaginationControls(
      "outdated",
      total,
      pageSize,
      page,
    );
    if (mainContent && paginationHTML) {
      mainContent.insertAdjacentHTML("beforeend", paginationHTML);
    }
  }

  // Update subtitle
  const subtitle = document.querySelector(".view-subtitle");
  if (subtitle) {
    subtitle.textContent = `${total} package${total !== 1 ? "s" : ""} need updating`;
  }
};

window.handleInstalledSearch = function (value) {
  window.app.state.viewData = window.app.state.viewData || {};
  const vd = window.app.state.viewData.installed;
  if (!vd) return;
  vd.query = value || "";
  vd.page = 1;

  // Update only the package list and pagination to avoid losing focus
  const { items, page, pageSize, query } = vd;
  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes((query || "").toLowerCase()),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const listContainer = document.getElementById("package-list-installed");
  if (listContainer) {
    listContainer.innerHTML = pageItems
      .map(
        (pkg) => `
      <div class="package-item" data-package="${pkg.name}">
        <div class="package-info">
          <div class="package-name">${pkg.name} <span class="badge badge-info" style="margin-left:8px;">${escapeHtml(pkg.types ? (pkg.types.length === 1 ? pkg.types[0] : pkg.types.join(",")) : (pkg.type || "unknown"))}</span></div>
          <div class="package-version">Click for details</div>
        </div>
        <div class="package-actions">
          <button class="btn btn-secondary" onclick="handlePackageInfo('${pkg.name}')">Info</button>
          <button class="btn btn-danger" onclick="handleUninstall('${pkg.name}')">Uninstall</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // Update pagination
  const paginationContainer = document.querySelector(
    '.pagination[data-view="installed"]',
  );
  if (paginationContainer) {
    const paginationHTML = renderPaginationControls(
      "installed",
      total,
      pageSize,
      page,
    );
    if (paginationHTML) {
      paginationContainer.outerHTML = paginationHTML;
    } else {
      paginationContainer.remove();
    }
  } else if (total > pageSize) {
    // Add pagination if it doesn't exist and we need it
    const mainContent = document.getElementById("main-content");
    const paginationHTML = renderPaginationControls(
      "installed",
      total,
      pageSize,
      page,
    );
    if (mainContent && paginationHTML) {
      mainContent.insertAdjacentHTML("beforeend", paginationHTML);
    }
  }

  // Update subtitle
  const subtitle = document.querySelector(".view-subtitle");
  if (subtitle) {
    subtitle.textContent = `${total} package${total !== 1 ? "s" : ""} installed`;
  }
};

// Debounced search helper for install view
window.__installSearchTimeout = window.__installSearchTimeout || null;
window.handleInstallSearch = function (value) {
  window.app.state.viewData = window.app.state.viewData || {};
  window.app.state.viewData.install = window.app.state.viewData.install || {
    items: [],
    page: 1,
    pageSize: 20,
    query: "",
  };
  const oldQuery = window.app.state.viewData.install.query;
  window.app.state.viewData.install.query = value || "";
  window.app.state.viewData.install.page = 1;
  clearTimeout(window.__installSearchTimeout);
  if (!value || value.length < 2) {
    // Only re-render if query changed to avoid losing focus
    if (oldQuery !== value) {
      const resultsDiv = document.getElementById("search-results");
      if (resultsDiv) {
        resultsDiv.innerHTML = `
          <div class="empty-state">
            <p class="empty-state-text">Enter a package name to search</p>
          </div>
        `;
      }
    }
    return;
  }
  window.__installSearchTimeout = setTimeout(() => {
    window.handleSearch(value);
  }, 400);
};

window.goToPage = function (viewKey, page) {
  window.app.state.viewData = window.app.state.viewData || {};
  const vd = window.app.state.viewData[viewKey];
  if (!vd) return;
  vd.page = Math.max(1, page);

  const container = document.getElementById("main-content");
  if (!container) return;

  if (viewKey === "installed") {
    container.innerHTML = renderInstalledPage();
  } else if (viewKey === "outdated") {
    container.innerHTML = renderOutdatedPage();
  } else if (viewKey === "install") {
    container.innerHTML = renderInstallPage();
  } else if (viewKey === "logs") {
    container.innerHTML = renderLogsPage();
  }
};
