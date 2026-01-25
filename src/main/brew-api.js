const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Menu, Tray, Notification } = require('electron');

// Registers brew-related IPC handlers. Call init with an object:
// { ipcMain, store, getMainWindow, detectedBrewPath }
function init({ ipcMain, store, getMainWindow, detectedBrewPath }) {
  // Helper to execute brew commands using configured brew path
  // LRU cache with size limits to prevent memory leaks
  const CACHE_MAX_SIZE = 100;
  const CACHE_CLEANUP_INTERVAL = 60000; // 1 minute
  const _cache = new Map();
  const _cacheAccessOrder = []; // Track access order for LRU
  
  function _getCache(key, ttlMs = 5000) {
    const entry = _cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.ts > ttlMs) {
      _cache.delete(key);
      return null;
    }
    
    // Update access order for LRU
    const idx = _cacheAccessOrder.indexOf(key);
    if (idx > -1) _cacheAccessOrder.splice(idx, 1);
    _cacheAccessOrder.push(key);
    
    return entry.value;
  }
  
  function _setCache(key, value) {
    // Evict oldest entries if cache is full (LRU)
    if (_cache.size >= CACHE_MAX_SIZE) {
      const oldestKey = _cacheAccessOrder.shift();
      if (oldestKey) _cache.delete(oldestKey);
    }
    
    _cache.set(key, { value, ts: Date.now() });
    _cacheAccessOrder.push(key);
  }
  
  // Periodic cache cleanup to prevent stale entries
  const _cacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    for (const [key, entry] of _cache.entries()) {
      if (now - entry.ts > maxAge) {
        _cache.delete(key);
        const idx = _cacheAccessOrder.indexOf(key);
        if (idx > -1) _cacheAccessOrder.splice(idx, 1);
      }
    }
  }, CACHE_CLEANUP_INTERVAL);
  
  // Prevent timer from keeping process alive
  if (_cacheCleanupTimer.unref) _cacheCleanupTimer.unref();

  async function executeBrewCommand(command, args = [], options = {}) {
    // options: { ttlMs } - if ttlMs provided, cache the successful output
    return new Promise((resolve, reject) => {
      const brewPath = store.get('brewPath', detectedBrewPath || '/opt/homebrew/bin/brew');
      const cacheKey = `${brewPath}::${command}::${(args || []).join(' ')}`;
      const ttl = options.ttlMs;
      
      if (ttl) {
        const cached = _getCache(cacheKey, ttl);
        if (cached) return resolve({ success: true, output: cached.output, error: cached.error });
      }

      const brewProcess = spawn(brewPath, [command, ...args]);
      
      // Use arrays for string accumulation (more efficient than concatenation)
      const stdoutChunks = [];
      const stderrChunks = [];
      let resolved = false;

      // Set encoding once during spawn options would be more efficient
      if (brewProcess.stdout) {
        brewProcess.stdout.setEncoding('utf8');
        brewProcess.stdout.on('data', (data) => {
          stdoutChunks.push(data);
        });
      }

      if (brewProcess.stderr) {
        brewProcess.stderr.setEncoding('utf8');
        brewProcess.stderr.on('data', (data) => {
          stderrChunks.push(data);
        });
      }

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        // Remove all listeners to prevent memory leaks
        brewProcess.removeAllListeners();
        if (brewProcess.stdout) brewProcess.stdout.removeAllListeners();
        if (brewProcess.stderr) brewProcess.stderr.removeAllListeners();
      };

      brewProcess.on('error', (err) => {
        cleanup();
        reject({ success: false, output: '', error: String(err), code: -1 });
      });

      brewProcess.on('close', (code) => {
        cleanup();
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');
        
        if (code === 0) {
          if (ttl) _setCache(cacheKey, { output: stdout, error: stderr });
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
      error,
    });
    if (logs.length > 100) logs.pop();
    store.set('logs', logs);
  }

  function sendNotification(title, body) {
    if (Notification.isSupported() && store.get('notifications', true)) {
      new Notification({ title, body }).show();
    }
  }

  // Execute brew commands
  ipcMain.handle('brew:execute', async (event, command, args = []) => {
    return new Promise((resolve, reject) => {
      const brewPath = store.get('brewPath', detectedBrewPath);

      if (!fs.existsSync(brewPath)) {
        reject({
          success: false,
          output: '',
          error: `Homebrew not found at: ${brewPath}\n\nPlease:\n1. Install Homebrew from https://brew.sh/\n2. Or update the brew path in Settings`,
          code: -1,
        });
        return;
      }

      const brewProcess = spawn(brewPath, [command, ...args]);
      let stdout = '';
      let stderr = '';

      brewProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        const mw = getMainWindow();
        mw?.webContents.send('brew:progress', data.toString());
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
      // Use cached versions for frequently-called, stable info
      const versionResult = await executeBrewCommand('--version', [], { ttlMs: 5000 });
      const version = (versionResult.output || '').split('\n')[0];

      const [formulaeResult, casksResult, outdatedResult] = await Promise.all([
        executeBrewCommand('list', ['--formula'], { ttlMs: 5000 }),
        executeBrewCommand('list', ['--cask'], { ttlMs: 5000 }),
        executeBrewCommand('outdated', [], { ttlMs: 3000 }),
      ]);

      // Single-pass parsing with trim check (more efficient)
      const parseLines = (output) => {
        if (!output) return [];
        const lines = [];
        let start = 0;
        for (let i = 0; i < output.length; i++) {
          if (output[i] === '\n' || output[i] === '\r') {
            if (i > start) {
              const line = output.slice(start, i).trim();
              if (line) lines.push(line);
            }
            start = output[i + 1] === '\n' ? i + 2 : i + 1;
          }
        }
        if (start < output.length) {
          const line = output.slice(start).trim();
          if (line) lines.push(line);
        }
        return lines;
      };
      
      const formulae = parseLines(formulaeResult.output);
      const casks = parseLines(casksResult.output);
      const outdated = parseLines(outdatedResult.output);

      return {
        version,
        formulaeCount: formulae.length,
        casksCount: casks.length,
        outdatedCount: outdated.length,
        lastUpdate: store.get('lastUpdate', null),
      };
    } catch (error) {
      throw error;
    }
  });

  // Get installed packages
  ipcMain.handle('brew:installed', async (event, type = 'all') => {
    try {
      // If caller requested a specific type, only fetch that list
      if (type === 'formula') {
        const res = await executeBrewCommand('list', ['--formula'], { ttlMs: 5000 });
        const formulae = (res.output || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        return formulae.map((name) => ({ name, types: ['formula'], type: 'formula' }));
      }

      if (type === 'cask') {
        const res = await executeBrewCommand('list', ['--cask'], { ttlMs: 5000 });
        const casks = (res.output || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        return casks.map((name) => ({ name, types: ['cask'], type: 'cask' }));
      }

      // For 'all', run both commands in parallel and merge types (use cache)
      const [formulaRes, caskRes] = await Promise.all([
        executeBrewCommand('list', ['--formula'], { ttlMs: 5000 }),
        executeBrewCommand('list', ['--cask'], { ttlMs: 5000 }),
      ]);
      
      // Optimized line parsing
      const parseLines = (output) => {
        if (!output) return [];
        const lines = [];
        let start = 0;
        for (let i = 0; i < output.length; i++) {
          if (output[i] === '\n' || output[i] === '\r') {
            if (i > start) {
              const line = output.slice(start, i).trim();
              if (line) lines.push(line);
            }
            start = output[i + 1] === '\n' ? i + 2 : i + 1;
          }
        }
        if (start < output.length) {
          const line = output.slice(start).trim();
          if (line) lines.push(line);
        }
        return lines;
      };
      
      const formulae = parseLines(formulaRes.output);
      const casks = parseLines(caskRes.output);

      // Build package map efficiently
      const packageMap = new Map();
      
      // Pre-allocate Set for each package to maintain consistent hidden class
      for (let i = 0; i < formulae.length; i++) {
        const name = formulae[i];
        if (!packageMap.has(name)) {
          packageMap.set(name, { isFormula: true, isCask: false });
        } else {
          packageMap.get(name).isFormula = true;
        }
      }
      
      for (let i = 0; i < casks.length; i++) {
        const name = casks[i];
        if (!packageMap.has(name)) {
          packageMap.set(name, { isFormula: false, isCask: true });
        } else {
          packageMap.get(name).isCask = true;
        }
      }

      // Convert to result array with consistent object shape for V8 optimization
      const combined = new Array(packageMap.size);
      let idx = 0;
      
      for (const [name, flags] of packageMap.entries()) {
        // Consistent object shape: always include all properties in same order
        if (flags.isFormula && flags.isCask) {
          combined[idx++] = { name, types: ['formula', 'cask'], type: 'both' };
        } else if (flags.isFormula) {
          combined[idx++] = { name, types: ['formula'], type: 'formula' };
        } else {
          combined[idx++] = { name, types: ['cask'], type: 'cask' };
        }
      }
      
      // Use native sort with optimized comparison
      combined.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
      
      return combined;
    } catch (error) {
      throw error;
    }
  });

  // Get outdated packages
  ipcMain.handle('brew:outdated', async () => {
    try {
      let result;
      try {
        result = await executeBrewCommand('outdated', ['--json=v2']);
      } catch (e) {
        try {
          result = await executeBrewCommand('outdated', ['--json']);
        } catch (e2) {
          result = await executeBrewCommand('outdated', []);
        }
      }

      const out = result.output && result.output.trim();
      if (!out) return [];

      try {
        const parsed = JSON.parse(result.output);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') {
          const combined = [];
          if (Array.isArray(parsed.formulae)) combined.push(...parsed.formulae.map((f) => ({ ...f, type: 'formula' })));
          if (Array.isArray(parsed.casks)) combined.push(...parsed.casks.map((c) => ({ ...c, type: 'cask' })));
          return combined;
        }
      } catch (jsonErr) {
        const lines = result.output.split('\n').map((l) => l.trim()).filter(Boolean);
        return lines.map((name) => ({ name, installed_versions: [], current_version: null }));
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
      const lines = result.output.split('\n').filter((l) => l.trim());
      const entries = [];
      for (const line of lines) {
        const m = line.match(/^([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.*)$/);
        if (m) {
          entries.push({ name: m[1].trim(), status: m[2].trim(), user: m[3].trim(), plist: (m[4] || '').trim(), raw: line });
        } else {
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
      const result = await executeBrewCommand('deps', ['--tree', formula]);
      return { success: true, tree: result.output };
    } catch (error) {
      return { success: false, error: error.error || error.message };
    }
  });

  ipcMain.handle('brew:deps:graph', async (event, packages = []) => {
    try {
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
      const lines = (content || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const toInstall = [];
      for (const line of lines) {
        const m = line.match(/^(brew|cask)\s+"([^"]+)"/);
        if (m) toInstall.push({ type: m[1], name: m[2] });
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

  // Search packages
  ipcMain.handle('brew:search', async (event, query) => {
    try {
      const result = await executeBrewCommand('search', [query]);
      return result.output.split('\n').filter((l) => l.trim());
    } catch (error) {
      throw error;
    }
  });

  // Get package info
  ipcMain.handle('brew:package-info', async (event, packageName) => {
    try {
      // Prefer JSON v2 which returns { formulae: [], casks: [] }
      let result;
      try {
        result = await executeBrewCommand('info', ['--json=v2', packageName]);
      } catch (e) {
        // Fallback to older --json or positional order
        try {
          result = await executeBrewCommand('info', ['--json', packageName]);
        } catch (e2) {
          result = await executeBrewCommand('info', [packageName, '--json']);
        }
      }

      const out = result.output && result.output.trim();
      if (!out) return null;

      let parsed;
      try {
        parsed = JSON.parse(out);
      } catch (jsonErr) {
        throw jsonErr;
      }

      // Normalize v2 object shape to always provide arrays for formulae and casks
      let formulae = [];
      let casks = [];

      if (Array.isArray(parsed)) {
        // Older formats return an array of formula objects
        formulae = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.formulae)) formulae = parsed.formulae;
        if (Array.isArray(parsed.casks)) casks = parsed.casks;
        // Some tools may return formulae as top-level array under other keys
        if (!formulae.length && Array.isArray(parsed)) formulae = parsed;
      }

      const types = new Set();
      if (formulae.length) types.add('formula');
      if (casks.length) types.add('cask');

      // When a name exists as both, mark both; include raw parsed response for consumers
      return {
        success: true,
        types: Array.from(types),
        formulae,
        casks,
        raw: parsed,
      };
    } catch (error) {
      throw error;
    }
  });

  // Install package
  ipcMain.handle('brew:install', async (event, packageName, isCask = false) => {
    try {
      const args = isCask ? ['install', '--cask', packageName] : ['install', packageName];
      const result = await executeBrewCommand(args[0], args.slice(1));
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
        const timeoutMinutes = Number(store.get('upgradeTimeoutMinutes', 10)) || 10;
        const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
        activityTimeout = setTimeout(() => {
          proc.kill('SIGKILL');
          reject({
            success: false,
            error: 'Upgrade process timed out due to inactivity. It might be stuck waiting for a password. Try running "brew upgrade" in your terminal.',
            code: -1,
          });
        }, timeoutMs);
      };

      resetTimeout();

      proc.stdout.on('data', (data) => {
        resetTimeout();
        const text = data.toString();
        stdout += text;
        const mw = getMainWindow();
        mw?.webContents.send('brew:upgrade:progress', { line: text });
        const m = text.match(/^(?:==>\s)?Upgrading\s(.+?)\s/);
        if (m && m[1]) mw?.webContents.send('brew:upgrade:current', { package: m[1].trim() });
      });

      proc.stderr.on('data', (data) => {
        resetTimeout();
        const text = data.toString();
        stderr += text;
        const mw = getMainWindow();
        mw?.webContents.send('brew:upgrade:progress', { line: text });
      });

      proc.on('close', (code) => {
        clearTimeout(activityTimeout);
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

  // Notification handler
  ipcMain.handle('notification:send', async (event, title, body) => {
    sendNotification(title, body);
    return true;
  });
  
  // Cleanup function to be called on shutdown
  function cleanup() {
    if (_cacheCleanupTimer) {
      clearInterval(_cacheCleanupTimer);
    }
    _cache.clear();
    _cacheAccessOrder.length = 0;
  }
  
  return { cleanup };
}

module.exports = { init };
