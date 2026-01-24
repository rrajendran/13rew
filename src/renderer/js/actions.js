// Action handlers

// Update brew
async function handleUpdate() {
  const confirmed = await showModal('Confirm Update', '<p>Update Homebrew metadata? This will run: brew update</p>', {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;
  
  try {
    showModal('Updating Brew', 'Updating Homebrew metadata...', { loading: true });
    await window.brewAPI.update();
    closeModal();
    window.app.showNotification('Success', 'Homebrew updated successfully', 'success');
    await window.app.loadView('dashboard');
  } catch (error) {
    closeModal();
    // Format error for display: prefer message/error/output, fallback to JSON
    const formatErrorForModal = (err) => {
      if (!err) return 'Unknown error';
      if (typeof err === 'string') return err;
      if (err.message || err.error || err.output) return err.message || err.error || err.output;
      try { return JSON.stringify(err, Object.getOwnPropertyNames(err), 2); } catch (e) { return String(err); }
    };

    const escapeHtml = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const errText = formatErrorForModal(error);
    showModal('Update Failed', `<pre class="terminal-output">${escapeHtml(errText)}</pre>`);
  }
}

// Upgrade all packages
async function handleUpgradeAll() {
  // Fetch outdated packages list first
  showModal('Loading...', 'Checking for outdated packages...', { loading: true });
  
  let outdatedData;
  try {
    outdatedData = await window.brewAPI.getOutdated();
  } catch (error) {
    closeModal();
    showModal('Error', 'Failed to fetch outdated packages: ' + (error.message || error));
    return;
  }
  
  // getOutdated returns an array directly
  const outdatedPackages = (outdatedData || []).map(it => {
    const name = it.name || it.full_name || it;
    const installed_versions = it.installed_versions || it.installed || [];
    const current_version = it.current_version || it.current || null;
    
    let latest_version = null;
    if (it.latest_version) latest_version = it.latest_version;
    else if (it.new_version) latest_version = it.new_version;
    else if (it.newer_versions && Array.isArray(it.newer_versions) && it.newer_versions.length) latest_version = it.newer_versions[0];
    else if (it.versions && (it.versions.stable || it.versions.current)) latest_version = it.versions.stable || it.versions.current;
    else if (it.version) latest_version = it.version;
    else if (it.current_version && (!installed_versions || installed_versions.length === 0)) latest_version = it.current_version;
    
    return { name, installed_versions, current_version, latest_version };
  });
  
  if (!outdatedPackages || outdatedPackages.length === 0) {
    closeModal();
    showModal('No Packages', 'No outdated packages to upgrade.');
    return;
  }

  closeModal();
  const confirmed = await showModal('Confirm Upgrade', `<p>Upgrade ${outdatedPackages.length} outdated package(s) one by one? This may take several minutes.</p>`, {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;

  // Track results
  const results = {
    success: [],
    failed: []
  };

  // Show progress modal
  const content = `
    <div style="margin-bottom:12px;"><strong>Progress:</strong> <span id="upgrade-progress-text">0/${outdatedPackages.length}</span></div>
    <div style="margin-bottom:12px;"><strong>Current:</strong> <span id="upgrade-current">-</span></div>
    <div style="margin-bottom:12px;"><progress id="upgrade-progress" value="0" max="100" style="width:100%"></progress></div>
    <pre id="upgrade-log" class="terminal-output" style="max-height:240px; overflow:auto;"></pre>
  `;
  showModal('Upgrading Packages', content);

  // Upgrade packages one by one
  for (let i = 0; i < outdatedPackages.length; i++) {
    const pkg = outdatedPackages[i];
    const packageName = pkg.name;

    try {
      // Update progress
      const progressText = document.getElementById('upgrade-progress-text');
      if (progressText) progressText.textContent = `${i + 1}/${outdatedPackages.length}`;

      const progressBar = document.getElementById('upgrade-progress');
      if (progressBar) progressBar.value = ((i + 1) / outdatedPackages.length) * 100;

      const currentEl = document.getElementById('upgrade-current');
      if (currentEl) currentEl.textContent = `Upgrading ${packageName}...`;

      const log = document.getElementById('upgrade-log');
      if (log) {
        log.textContent += `\n==> Upgrading ${packageName} (${i + 1}/${outdatedPackages.length})\n`;
        log.scrollTop = log.scrollHeight;
      }

      // Subscribe to progress events
      let currentPkgName = packageName;
      const unsubProgress = window.brewAPI.onUpgradeProgress((data) => {
        try {
          const line = (data && (data.line || data)) || '';
          const log = document.getElementById('upgrade-log');
          if (log) { 
            log.textContent += `${line}\n`; 
            log.scrollTop = log.scrollHeight; 
          }

          // detect "Upgrading <pkg>" lines
          const upMatch = line.match(/(?:==>\s*)?Upgrading\s+([^\s:]+)\b/i);
          if (upMatch && upMatch[1]) {
            currentPkgName = upMatch[1].trim();
          }

          // parse version lines
          const verMatch = line.match(/([0-9A-Za-z.+-]+)\s*(?:->|=>)\s*([0-9A-Za-z.+-]+)/);
          if (verMatch && verMatch[1] && verMatch[2]) {
            const oldVer = verMatch[1];
            const newVer = verMatch[2];
            const cur = document.getElementById('upgrade-current');
            if (cur) {
              cur.textContent = `Upgrading ${currentPkgName} from ${oldVer} to ${newVer}`;
            }
          }
        } catch (e) {}
      });

      const unsubCurrent = window.brewAPI.onUpgradeCurrent((data) => {
        try {
          currentPkgName = data.package;
          const cur = document.getElementById('upgrade-current');
          if (cur) {
            const pkgInfo = outdatedPackages.find(p => p.name === data.package) || {};
            const oldVer = (pkgInfo.installed_versions && pkgInfo.installed_versions[0]) || pkgInfo.current_version || 'unknown';
            const newVer = pkgInfo.latest_version || pkgInfo.new_version || (pkgInfo.newer_versions && pkgInfo.newer_versions[0]) || pkgInfo.version || 'latest';
            cur.textContent = `Upgrading ${data.package} from ${oldVer} to ${newVer}`;
          }
        } catch (e) {}
      });

      // Upgrade the package
      await window.brewAPI.upgrade(packageName);

      // Cleanup subscriptions
      try { if (typeof unsubProgress === 'function') unsubProgress(); } catch (e) {}
      try { if (typeof unsubCurrent === 'function') unsubCurrent(); } catch (e) {}

      // Mark as success
      results.success.push(packageName);

      const log2 = document.getElementById('upgrade-log');
      if (log2) {
        log2.textContent += `✓ ${packageName} upgraded successfully\n`;
        log2.scrollTop = log2.scrollHeight;
      }

    } catch (error) {
      // Cleanup subscriptions on error
      try { const unsubProgress = window.brewAPI.onUpgradeProgress(() => {}); if (typeof unsubProgress === 'function') unsubProgress(); } catch (e) {}
      try { const unsubCurrent = window.brewAPI.onUpgradeCurrent(() => {}); if (typeof unsubCurrent === 'function') unsubCurrent(); } catch (e) {}

      // Mark as failed and capture error
      const errorMessage = error.message || error.error || error.output || (typeof error === 'string' ? error : JSON.stringify(error, null, 2));
      results.failed.push({ package: packageName, error: errorMessage });

      const log = document.getElementById('upgrade-log');
      if (log) {
        log.textContent += `✗ ${packageName} upgrade failed: ${errorMessage.split('\n')[0]}\n`;
        log.scrollTop = log.scrollHeight;
      }

      // Continue with next package
      continue;
    }
  }

  closeModal();

  // Show summary
  let summaryHtml = '<div style="text-align:left;">';
  
  if (results.success.length > 0) {
    summaryHtml += `<p><strong>✓ Successfully upgraded (${results.success.length}):</strong></p>`;
    summaryHtml += '<ul style="margin-left:20px;">';
    results.success.forEach(pkg => {
      summaryHtml += `<li>${pkg}</li>`;
    });
    summaryHtml += '</ul>';
  }

  if (results.failed.length > 0) {
    summaryHtml += `<p><strong>✗ Failed to upgrade (${results.failed.length}):</strong></p>`;
    summaryHtml += '<ul style="margin-left:20px; color:#e74c3c;">';
    results.failed.forEach(item => {
      const shortError = item.error.split('\n')[0].substring(0, 100);
      summaryHtml += `<li><strong>${item.package}</strong>: ${shortError}...</li>`;
    });
    summaryHtml += '</ul>';
  }

  summaryHtml += '</div>';

  await showModal('Upgrade Complete', summaryHtml, {
    buttons: [
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });

  // Reload outdated view
  await window.app.loadView('outdated');
}

// Upgrade single package
async function handleUpgrade(packageName) {
  const confirmed = await showModal('Confirm Upgrade', `<p>Upgrade ${packageName}?</p>`, {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;
  
  try {
    const content = `
      <div style="margin-bottom:12px;"><strong>Current:</strong> <span id="upgrade-current">-</span></div>
      <div style="margin-bottom:12px;"><progress id="upgrade-progress" value="0" max="100" style="width:100%"></progress></div>
      <pre id="upgrade-log" class="terminal-output" style="max-height:240px; overflow:auto;"></pre>
    `;
    showModal(`Upgrading ${packageName}`, content);

    let currentPkgName = null;
    const unsubProgress = window.brewAPI.onUpgradeProgress((data) => {
      try {
        const line = (data && (data.line || data)) || '';
        const log = document.getElementById('upgrade-log');
        if (log) { log.textContent += `${line}\n`; log.scrollTop = log.scrollHeight; }

        // parse percent if provided
        if (data && data.percent !== undefined) {
          const p = document.getElementById('upgrade-progress'); if (p) p.value = Number(data.percent);
        }

        // detect "Upgrading <pkg>" lines and remember the package name
        const upMatch = line.match(/(?:==>\s*)?Upgrading\s+([^\s:]+)\b/i);
        if (upMatch && upMatch[1]) {
          currentPkgName = upMatch[1].trim();
          const curEl = document.getElementById('upgrade-current');
          if (curEl) curEl.textContent = `Upgrading ${currentPkgName}`;
        }

        // parse version lines like "4.2.4 -> 4.2.8" or "4.2.4 => 4.2.8"
        const verMatch = line.match(/([0-9A-Za-z.+-]+)\s*(?:->|=>)\s*([0-9A-Za-z.+-]+)/);
        if (verMatch && verMatch[1] && verMatch[2]) {
          const oldVer = verMatch[1];
          const newVer = verMatch[2];
          const cur = document.getElementById('upgrade-current');
          if (cur) {
            let pkg = currentPkgName;
            if (!pkg) {
              const logText = log ? log.textContent : '';
              const upAll = logText.match(/(?:==>\s*)?Upgrading\s+([^\s:]+)\b(?![\s\S]*Upgrading)/i);
              if (upAll && upAll[1]) pkg = upAll[1].trim();
            }
            if (!pkg) {
              pkg = (window.app.state.viewData?.outdated?.items || []).find(p => line.includes(p.name))?.name || 'unknown';
            }
            cur.textContent = `Upgrading ${pkg} from ${oldVer} to ${newVer}`;
          }
        }
      } catch (e) {}
    });

    const unsubCurrent = window.brewAPI.onUpgradeCurrent((data) => {
      try {
        currentPkgName = data.package;
        const cur = document.getElementById('upgrade-current');
        if (cur) {
          const pkgName = data.package;
          console.log('pkgName data: '+ JSON.stringify(data));
          const outdatedPackages = window.app.state.viewData?.outdated?.items || [];
          const pkgInfo = outdatedPackages.find(p => p.name === pkgName) || {};
          console.log('pkgInfo:' + JSON.stringify(pkgInfo));
          const oldVer = (pkgInfo.installed_versions && pkgInfo.installed_versions[0]) || pkgInfo.current_version || 'unknown';
          const newVer = pkgInfo.latest_version || pkgInfo.new_version || (pkgInfo.newer_versions && pkgInfo.newer_versions[0]) || pkgInfo.version || 'latest';
          console.log('oldVer,newVer', oldVer, newVer);
          cur.textContent = `Upgrading ${pkgName} from ${oldVer} to ${newVer}`;
        }
      } catch (e) {}
    });

    await window.brewAPI.upgrade(packageName);

    try { if (typeof unsubProgress === 'function') unsubProgress(); } catch (e) {}
    try { if (typeof unsubCurrent === 'function') unsubCurrent(); } catch (e) {}

    closeModal();
    window.app.showNotification('Success', `${packageName} upgraded successfully`, 'success');
    await window.app.loadView('outdated');
  } catch (error) {
    try { const unsubProgress = window.brewAPI.onUpgradeProgress(() => {}); if (typeof unsubProgress === 'function') unsubProgress(); } catch (e) {}
    try { const unsubCurrent = window.brewAPI.onUpgradeCurrent(() => {}); if (typeof unsubCurrent === 'function') unsubCurrent(); } catch (e) {}
    closeModal();
    const errorMessage = error.message || error.error || error.output || (typeof error === 'string' ? error : JSON.stringify(error, null, 2));
    await handleUpgradeErrorModal(errorMessage);
  }
}

// Uninstall package
async function handleUninstall(packageName) {
  const confirmed = await showModal('Confirm Uninstall', `<p>Are you sure you want to uninstall ${packageName}?</p>`, {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;
  
  try {
    showModal('Uninstalling Package', `Uninstalling ${packageName}...`, { loading: true });
    await window.brewAPI.uninstall(packageName);
    closeModal();
    window.app.showNotification('Success', `${packageName} uninstalled successfully`, 'success');
    await window.app.loadView('installed');
  } catch (error) {
    closeModal();
    showModal('Uninstall Failed', error.error || error.message);
  }
}

// Get package info
async function handlePackageInfo(packageName) {
  try {
    showModal('Loading...', 'Fetching package information...', { loading: true });
    const info = await window.brewAPI.getPackageInfo(packageName);
    closeModal();
    
    showModal(
      `Package: ${info.name}`,
      `
        <div style="margin-bottom: 16px;">
          <strong>Description:</strong><br>
          ${info.desc || 'No description available'}
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Homepage:</strong><br>
          <a href="${info.homepage}" style="color: var(--primary-action);">${info.homepage}</a>
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Version:</strong> ${info.versions?.stable || 'Unknown'}
        </div>
        ${info.dependencies?.length ? `
          <div style="margin-bottom: 16px;">
            <strong>Dependencies:</strong><br>
            ${info.dependencies.join(', ')}
          </div>
        ` : ''}
      `
    );
  } catch (error) {
    closeModal();
    showModal('Error', `Failed to load package info: ${error.message}`);
  }
}

// Service actions
async function handleServiceAction(action, name) {
  const confirmed = await showModal('Confirm Service Action', `<p>${action} service ${name}?</p>`, {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;
  try {
    showModal(`${action} ${name}`, `${action}ing ${name}...`, { loading: true });
    const res = await window.brewV2.services.action(action, name);
    closeModal();
    if (res.success) {
      window.app.showNotification('Service Updated', `${name} ${action}ed`, 'success');
      await window.app.loadView('services');
    } else {
      showModal('Service Error', res.error || 'Unknown error');
    }
  } catch (e) {
    closeModal();
    showModal('Service Error', e.message || e);
  }
}

// Show service details
async function handleShowServiceDetail(name) {
  try {
    showModal('Loading...', 'Fetching service details...', { loading: true });
    // get service list and package info
    const services = await window.brewV2.services.list();
    const service = (services || []).find(s => s.name === name) || {};
    let pkgInfo = null;
    try {
      pkgInfo = await window.brewAPI.getPackageInfo(name);
    } catch (e) {
      // ignore missing package info
    }
    closeModal();

    const content = `
      <div style="margin-bottom:12px;"><strong>Name:</strong> ${escapeHtml(name)}</div>
      <div style="margin-bottom:12px;"><strong>Status:</strong> ${escapeHtml(service.status || 'unknown')}</div>
      ${service.user ? `<div style="margin-bottom:12px;"><strong>User:</strong> ${escapeHtml(service.user)}</div>` : ''}
      ${service.plist ? `<div style="margin-bottom:12px;"><strong>Plist:</strong><br><pre class="terminal-output">${escapeHtml(service.plist)}</pre></div>` : ''}
      ${pkgInfo ? `
        <div style="margin-bottom:12px;"><strong>Description:</strong><br>${escapeHtml(pkgInfo.desc || 'N/A')}</div>
        <div style="margin-bottom:12px;"><strong>Homepage:</strong><br><a href="${pkgInfo.homepage || '#'}" onclick="event.preventDefault(); window.open('${pkgInfo.homepage || '#'}');">${pkgInfo.homepage || 'N/A'}</a></div>
      ` : ''}
    `;

    showModal(`Service: ${name}`, content);
  } catch (e) {
    closeModal();
    showModal('Error', e.message || e);
  }
}

// Brewfile export/import
async function handleExportBrewfile() {
  try {
    showModal('Exporting Brewfile', 'Preparing Brewfile...', { loading: true });
    const res = await window.brewV2.brewfile.export();
    closeModal();
    if (res.success) {
      showModal('Brewfile Export', `<pre class="terminal-output">${res.content}</pre>`);
    } else {
      showModal('Export Failed', `<p>${res.error || 'Unknown error'}</p>`);
    }
  } catch (e) {
    closeModal();
    showModal('Export Failed', `<p>${e.message || e}</p>`);
  }
}

async function handleImportBrewfile(content) {
  try {
    showModal('Import Brewfile', 'Analyzing Brewfile...', { loading: true });
    const dry = await window.brewV2.brewfile.import(content, { dryRun: true });
    closeModal();
    showModal('Brewfile Import (Dry Run)', `<pre class="terminal-output">${JSON.stringify(dry, null, 2)}</pre>`);
  } catch (e) {
    closeModal();
    showModal('Import Failed', `<p>${e.message || e}</p>`);
  }
}

// Menubar toggles
async function handleEnableMenubar() {
  const ok = await window.brewV2.menubar.enable();
  window.app.showNotification('Menubar', ok ? 'Menubar enabled' : 'Failed to enable', ok ? 'success' : 'error');
}

async function handleDisableMenubar() {
  const ok = await window.brewV2.menubar.disable();
  window.app.showNotification('Menubar', ok ? 'Menubar disabled' : 'Failed to disable', ok ? 'success' : 'error');
}

// Parse brew deps --tree output into hierarchical structure
function parseBrewTree(text) {
  const lines = text.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  if (lines.length === 0) return { name: 'empty', children: [] };
  
  const rootLine = lines.shift() || '';
  const root = { name: rootLine.trim().replace(/^[\u2500-\u257F\s]+/, ''), children: [] };
  const stack = [root];
  
  for (const raw of lines) {
    if (!raw.trim()) continue;
    
    // Count depth by analyzing box-drawing characters and indentation
    const withoutBoxChars = raw.replace(/[├└─│]/g, '');
    const leadingSpaces = raw.length - raw.trimStart().length;
    const level = Math.floor(leadingSpaces / 2);
    
    const name = raw.replace(/^[\s│├└─]+/, '').trim();
    const node = { name, children: [] };
    
    // Find parent at correct level
    const parentLevel = Math.min(level, stack.length - 1);
    const parent = stack[parentLevel] || root;
    parent.children = parent.children || [];
    parent.children.push(node);
    
    // Update stack for this level
    stack[level + 1] = node;
    stack.length = level + 2;
  }
  
  return root;
}

// Render D3 tree visualization
function renderD3Tree(rootData, containerSelector, packageName) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  // Create hierarchy first to determine size
  const root = d3.hierarchy(rootData);
  
  // Collapse all children except root
  root.descendants().forEach((d, i) => {
    if (d.depth > 0 && d.children) {
      d._children = d.children;
      d.children = null;
    }
  });
  
  const nodeHeight = 50; // Vertical space per node
  const nodeWidth = 180; // Horizontal space per level
  const margin = { top: 40, right: 100, bottom: 40, left: 120 };
  
  // Start with smaller initial dimensions
  const width = 1200;
  const height = 800;
  
  container.innerHTML = `
    <div class="card" style="overflow: auto; max-height: 800px;">
      <h3 style="margin-bottom: 12px; color: var(--text-primary);">Dependency Tree - (${packageName})</h3>
      <p style="margin-bottom: 12px; color: var(--text-muted); font-size: 12px;">Click nodes to expand/collapse • Scroll to zoom • Drag to pan</p>
      <svg id="tree-svg-${Date.now()}" width="${width}" height="${height}"></svg>
    </div>
  `;
  
  const svg = d3.select(container).select('svg');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Create tree layout
  const treeLayout = d3.tree()
    .nodeSize([nodeHeight, nodeWidth])
    .separation((a, b) => (a.parent == b.parent ? 1 : 1.2));
  
  let i = 0;
  const duration = 400;
  
  function update(source) {
    // Compute the new tree layout
    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();
    
    // Update nodes
    const node = g.selectAll('g.node')
      .data(nodes, d => d.id || (d.id = ++i));
    
    // Enter new nodes
    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${source.y0 || 0},${source.x0 || 0})`)
      .style('cursor', d => d._children || d.children ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      });
    
    nodeEnter.append('circle')
      .attr('r', 1e-6)
      .attr('fill', d => d._children ? '#58A6FF' : (d.children ? '#58A6FF' : '#3FB950'))
      .attr('stroke', '#0D1117')
      .attr('stroke-width', 2);
    
    nodeEnter.append('text')
      .attr('dy', '.35em')
      .attr('x', d => (d.children || d._children) ? -12 : 12)
      .attr('text-anchor', d => (d.children || d._children) ? 'end' : 'start')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', 'var(--text-primary)')
      .style('fill-opacity', 1e-6)
      .text(d => d.data.name);
    
    // Add +/- indicator for nodes with children
    nodeEnter.append('text')
      .attr('class', 'node-toggle')
      .attr('dy', '.35em')
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', '#0D1117')
      .style('pointer-events', 'none')
      .text(d => (d._children || d.children) ? (d.children ? '−' : '+') : '');
    
    // Update existing nodes
    const nodeUpdate = nodeEnter.merge(node);
    
    nodeUpdate.transition()
      .duration(duration)
      .attr('transform', d => `translate(${d.y},${d.x})`);
    
    nodeUpdate.select('circle')
      .transition()
      .duration(duration)
      .attr('r', 6)
      .attr('fill', d => d._children ? '#58A6FF' : (d.children ? '#58A6FF' : '#3FB950'));
    
    nodeUpdate.select('text:not(.node-toggle)')
      .transition()
      .duration(duration)
      .style('fill-opacity', 1)
      .attr('x', d => (d.children || d._children) ? -12 : 12)
      .attr('text-anchor', d => (d.children || d._children) ? 'end' : 'start');
    
    nodeUpdate.select('.node-toggle')
      .text(d => (d._children || d.children) ? (d.children ? '−' : '+') : '');
    
    // Remove exiting nodes
    const nodeExit = node.exit().transition()
      .duration(duration)
      .attr('transform', d => `translate(${source.y},${source.x})`)
      .remove();
    
    nodeExit.select('circle')
      .attr('r', 1e-6);
    
    nodeExit.select('text')
      .style('fill-opacity', 1e-6);
    
    // Update links
    const link = g.selectAll('path.link')
      .data(links, d => d.target.id);
    
    const linkEnter = link.enter().insert('path', 'g')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#58A6FF')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2)
      .attr('d', d => {
        const o = { x: source.x0 || 0, y: source.y0 || 0 };
        return diagonal(o, o);
      });
    
    const linkUpdate = linkEnter.merge(link);
    
    linkUpdate.transition()
      .duration(duration)
      .attr('d', d => diagonal(d.source, d.target));
    
    const linkExit = link.exit().transition()
      .duration(duration)
      .attr('d', d => {
        const o = { x: source.x, y: source.y };
        return diagonal(o, o);
      })
      .remove();
    
    // Store old positions for transition
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
  
  function diagonal(s, d) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }
  
  // Initialize positions
  root.x0 = height / 2;
  root.y0 = 0;
  
  // Initial render
  update(root);
  
  // Add hover effect
  g.selectAll('.node')
    .on('mouseenter', function() {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('r', 10);
      d3.select(this).select('text:not(.node-toggle)')
        .transition().duration(200)
        .attr('font-size', '16px')
        .attr('font-weight', '700');
    })
    .on('mouseleave', function() {
      d3.select(this).select('circle')
        .transition().duration(200)
        .attr('r', 6);
      d3.select(this).select('text:not(.node-toggle)')
        .transition().duration(200)
        .attr('font-size', '14px')
        .attr('font-weight', '500');
    });
}

// Generate dependency graph
async function handleGenerateGraph() {
  const input = document.getElementById('deps-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    showModal('Input Required', '<p>Enter at least one package.</p>');
    return;
  }
  const packages = raw.split(',').map(s => s.trim()).filter(Boolean);
  try {
    showModal('Generating Graph', 'Building dependency trees...', { loading: true });
    const res = await window.brewV2.deps.graph(packages);
    closeModal();
    const out = document.getElementById('deps-output');
    if (!out) return;
    if (!res.success) {
      out.innerHTML = `<div class="empty-state"><p class="empty-state-text">${res.error}</p></div>`;
      return;
    }
    
    // Render D3 trees for each package
    if (window.d3 && res.trees && res.trees.length > 0) {
      out.innerHTML = '<div id="tree-container"></div>';
      const treeContainer = document.getElementById('tree-container');
      
      res.trees.forEach((item, idx) => {
        if (!item.success || !item.tree) {
          const errDiv = document.createElement('div');
          errDiv.className = 'card';
          errDiv.innerHTML = `<p style="color: var(--error);">Failed to load tree for ${item.package}: ${item.error || 'Unknown error'}</p>`;
          treeContainer.appendChild(errDiv);
          return;
        }
        
        const treeDiv = document.createElement('div');
        treeDiv.id = `tree-${idx}`;
        treeContainer.appendChild(treeDiv);
        
        const rootData = parseBrewTree(item.tree);
        renderD3Tree(rootData, `#tree-${idx}`, item.package);
      });
    } else {
      // Fallback textual view
      const trees = res.trees.map(t => `=== ${t.package} ===\n${t.tree}`).join('\n\n');
      out.innerHTML = `<div class="card"><pre class="terminal-output">${trees}</pre></div>`;
    }
  } catch (e) {
    closeModal();
    showModal('Graph Error', e.message || e);
  }
}

// Search packages
async function handleSearch(query) {
  const resultsDiv = document.getElementById('search-results');
  if (resultsDiv) resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const results = await window.brewAPI.search(query);

    // store in state for pagination
    window.app.state.viewData = window.app.state.viewData || {};
    const pageSize = window.app.state.settings?.pageSize ?? 10;

    window.app.state.viewData.install = {
      items: results || [],
      page: 1,
      pageSize: pageSize,
      query: query
    };

    const container = document.getElementById('main-content');
    if (container) container.innerHTML = renderInstallPage();
  } catch (error) {
    if (resultsDiv) resultsDiv.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-state-title">Search Error</h2>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

// Install package
async function handleInstall(packageName, isCask = false) {
  const confirmed = await showModal('Confirm Install', `<p>Install ${packageName}?${isCask ? ' (Cask)' : ''}</p>`, {
    buttons: [
      { label: 'Cancel', value: false, class: 'btn-secondary' },
      { label: 'OK', value: true, class: 'btn-primary' }
    ]
  });
  if (!confirmed) return;
  
  try {
    showModal('Installing Package', `Installing ${packageName}...`, { loading: true });
    await window.brewAPI.install(packageName, isCask);
    closeModal();
    window.app.showNotification('Success', `${packageName} installed successfully`, 'success');
  } catch (error) {
    closeModal();
    showModal('Install Failed', error.error || error.message);
  }
}

// Show log error
function showLogError(error) {
  // Helper: unescape HTML entities (because callers may pass escaped strings)
  const unescapeHtml = (str) => String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  try {
    let text = '';
    if (typeof error === 'string') {
      text = unescapeHtml(error);
    } else {
      try {
        text = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      } catch (e) {
        text = String(error);
      }
    }

    // If text is JSON string, try to pretty-print it
    try {
      const parsed = JSON.parse(text);
      text = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // not JSON — leave as-is
    }

    showModal('Error Details', `<pre class="terminal-output">${escapeHtml(text)}</pre>`);
  } catch (e) {
    // Fallback
    showModal('Error Details', `<pre class="terminal-output">${String(error)}</pre>`);
  }
}

// Handle upgrade-specific errors by extracting suggested brew commands
async function handleUpgradeErrorModal(errorMessage) {
  // Find suggested brew commands in the error message (e.g. "brew link --overwrite qt" or "brew unlink qt")
  const suggestionRegex = /(^|\n)\s*(brew\s+[a-zA-Z0-9-\s--]+(?:--overwrite)?[^\r\n]*)/g;
  const matches = [];
  let m;
  while ((m = suggestionRegex.exec(errorMessage)) !== null) {
    const cmd = m[2].trim();
    if (cmd && !matches.includes(cmd)) matches.push(cmd);
  }

  const content = `<pre class="terminal-output">${errorMessage}</pre>`;

  if (matches.length === 0) {
    await showModal('Upgrade Failed', content);
    return;
  }

  // Check if this is a conflicting files error
  const isConflictError = errorMessage.includes('brew link') && errorMessage.includes('could not symlink');

  // Build buttons for suggestions
  const buttons = matches.map((cmd, idx) => {
    const isLinkOverwrite = cmd.includes('brew link --overwrite');
    return { 
      label: isLinkOverwrite ? `Run: ${cmd}` : `Copy: ${cmd}`, 
      value: isLinkOverwrite ? `run:${idx}` : `copy:${idx}`, 
      class: isLinkOverwrite ? 'btn-primary' : 'btn-secondary' 
    };
  });
  buttons.push({ label: 'Show Details', value: 'details', class: 'btn-secondary' });
  buttons.push({ label: 'Close', value: 'close', class: 'btn-secondary' });

  const choice = await showModal('Upgrade Failed — Actions', content, { buttons });

  if (choice && choice.startsWith('run:')) {
    const idx = Number(choice.split(':')[1]);
    const cmd = matches[idx];
    
    // Extract package name from command like "brew link --overwrite qt"
    const pkgMatch = cmd.match(/brew\s+link\s+--overwrite\s+([^\s]+)/);
    if (pkgMatch && pkgMatch[1]) {
      const packageName = pkgMatch[1];
      const confirmed = await showModal('Confirm Action', `<p>Run the following command to resolve the conflict?</p><pre>${cmd}</pre>`, {
        buttons: [
          { label: 'Cancel', value: false, class: 'btn-secondary' },
          { label: 'Run Command', value: true, class: 'btn-primary' }
        ]
      });
      
      if (confirmed) {
        try {
          showModal('Running Command', `Executing: ${cmd}`, { loading: true });
          // Execute the brew command via IPC
          await window.brewAPI.execute('link', ['--overwrite', packageName]);
          closeModal();
          await showModal('Success', `<p>Command executed successfully:</p><pre>${cmd}</pre>`);
        } catch (error) {
          closeModal();
          await showModal('Command Failed', `<p>Failed to execute command:</p><pre>${cmd}</pre><p>Error: ${error.message || error.error || 'Unknown error'}</p>`);
        }
      }
    }
  } else if (choice && choice.startsWith('copy:')) {
    const idx = Number(choice.split(':')[1]);
    const cmd = matches[idx];
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cmd);
        await showModal('Copied', `<p>Command copied to clipboard:</p><pre>${cmd}</pre>`);
      } else if (window.require) {
        // Fallback to Electron clipboard if available
        try {
          const { clipboard } = window.require('electron');
          clipboard.writeText(cmd);
          await showModal('Copied', `<p>Command copied to clipboard:</p><pre>${cmd}</pre>`);
        } catch (e) {
          await showModal('Copy Failed', `<p>Could not copy command. Please copy manually:</p><pre>${cmd}</pre>`);
        }
      } else {
        await showModal('Copy Unavailable', `<p>Copy is not available. Please copy manually:</p><pre>${cmd}</pre>`);
      }
    } catch (e) {
      await showModal('Copy Failed', `<p>Could not copy command. Please copy manually:</p><pre>${cmd}</pre>`);
    }
  } else if (choice === 'details') {
    await showModal('Details', content);
  }
}

// Settings handlers
async function handleThemeChange(theme) {
  console.log('Theme change requested:', theme);
  try {
    await window.brewAPI.settings.set('theme', theme);
    window.app.applyTheme(theme);
    window.app.showNotification('Theme Changed', `Applied ${theme} theme`, 'success');
  } catch (error) {
    console.error('Error changing theme:', error);
    window.app.showNotification('Theme Error', 'Failed to change theme', 'error');
  }
}

async function handleSettingChange(key, value) {
  console.log('Setting change:', key, value);
  try {
    await window.brewAPI.settings.set(key, value);
    window.app.showNotification('Settings Saved', `${key} updated`, 'success');
    
    // Reload view if pageSize changed to apply immediately
    if (key === 'pageSize' && window.state.currentView === 'installed') {
      await window.app.loadView('installed');
    }
  } catch (error) {
    console.error('Error saving setting:', error);
    window.app.showNotification('Settings Error', 'Failed to save setting', 'error');
  }
}

// Modal utilities
function showModal(title, content, options = {}) {
  return new Promise((resolve) => {
    const { loading = false, buttons = null } = options;

    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    let modalButtons = '';
    if (buttons) {
      modalButtons = buttons.map((btn, index) => 
        `<button class="btn ${btn.class || 'btn-secondary'}" id="modal-btn-${index}">${btn.label}</button>`
      ).join('');
    } else if (!loading) {
      modalButtons = `<button class="btn btn-secondary" id="modal-btn-close">Close</button>`;
    }
    
    const modalHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
          </div>
          <div class="modal-content">
            ${loading ? '<div class="loading"><div class="spinner"></div></div>' : content}
          </div>
          <div class="modal-actions">
            ${modalButtons}
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModalAndResolve = (value) => {
      const modal = document.querySelector('#modal-overlay');
      if (modal) {
        modal.remove();
      }
      resolve(value);
    };

    if (buttons) {
      buttons.forEach((btn, index) => {
        const btnEl = document.getElementById(`modal-btn-${index}`);
        if (btnEl) btnEl.onclick = () => closeModalAndResolve(btn.value);
      });
    } else if (!loading) {
      const closeBtn = document.getElementById('modal-btn-close');
      if (closeBtn) closeBtn.onclick = () => closeModalAndResolve('close');
    }

    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target.id === 'modal-overlay' && !loading) {
          closeModalAndResolve('close');
        }
      };
    }
  });
}

function closeModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Make functions global
window.handleUpdate = handleUpdate;
window.handleUpgradeAll = handleUpgradeAll;
window.handleUpgrade = handleUpgrade;
window.handleUninstall = handleUninstall;
window.handlePackageInfo = handlePackageInfo;
window.handleSearch = handleSearch;
window.handleInstall = handleInstall;
window.showLogError = showLogError;
window.handleThemeChange = handleThemeChange;
window.handleSettingChange = handleSettingChange;
window.showModal = showModal;
window.closeModal = closeModal;

window.handleServiceAction = handleServiceAction;
window.handleExportBrewfile = handleExportBrewfile;
window.handleImportBrewfile = handleImportBrewfile;
window.handleEnableMenubar = handleEnableMenubar;
window.handleDisableMenubar = handleDisableMenubar;
window.handleGenerateGraph = handleGenerateGraph;
window.handleShowServiceDetail = handleShowServiceDetail;
window.handleLogFilterChange = async function (key, value) {
  await handleSettingChange(key, value);
  // We need to re-render the logs view to apply the filter
  const container = document.getElementById("main-content");
  if (container && window.app.state.currentView === "logs") {
    container.innerHTML = await renderLogsPage();
  }
};
