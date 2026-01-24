# 13rew - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        13rew App                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Renderer Process (Chromium)                  │ │
│  │                                                           │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │           User Interface (HTML/CSS/JS)            │   │ │
│  │  │                                                    │   │ │
│  │  │  • index.html  - Structure                        │   │ │
│  │  │  • main.css    - Base styles                      │   │ │
│  │  │  • themes/     - Theme stylesheets                │   │ │
│  │  │  • app.js      - Core logic & routing             │   │ │
│  │  │  • views.js    - View rendering                   │   │ │
│  │  │  • actions.js  - User action handlers             │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  │                         │                                 │ │
│  │                         ↓                                 │ │
│  │              window.brewAPI (IPC Bridge)                 │ │
│  └─────────────────────────┬─────────────────────────────────┘ │
│                            │                                   │
│                   Context Bridge                              │
│                            │                                   │
│  ┌─────────────────────────┴─────────────────────────────────┐ │
│  │              Preload Script (preload.js)                  │ │
│  │                                                           │ │
│  │  • Exposes safe APIs to renderer                         │ │
│  │  • Bridges IPC communication                             │ │
│  │  • Maintains security isolation                          │ │
│  └─────────────────────────┬─────────────────────────────────┘ │
│                            │                                   │
│                     IPC Messages                              │
│                            │                                   │
│  ┌─────────────────────────┴─────────────────────────────────┐ │
│  │               Main Process (Node.js)                      │ │
│  │                                                           │ │
│  │  main.js:                                                │ │
│  │  • Window management                                      │ │
│  │  • IPC handlers (brew commands)                          │ │
│  │  • Settings storage (electron-store)                     │ │
│  │  • Logging system                                         │ │
│  │  • Notification system                                    │ │
│  │                                                           │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │        Electron Store (Persistent Storage)        │   │ │
│  │  │  • Settings (brewPath, theme, etc.)              │   │ │
│  │  │  • Logs (command history)                         │   │ │
│  │  │  • User preferences                                │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └─────────────────────────┬─────────────────────────────────┘ │
│                            │                                   │
│                      child_process.spawn()                    │
│                            │                                   │
└────────────────────────────┼───────────────────────────────────┘
                             ↓
                   ┌──────────────────┐
                   │   Homebrew CLI   │
                   │  (/opt/homebrew  │
                   │  /bin/brew)      │
                   └──────────────────┘
                             ↓
                   ┌──────────────────┐
                   │  macOS System    │
                   │  • Package files │
                   │  • Cellar        │
                   │  • Caskroom      │
                   └──────────────────┘
```

## Communication Flow

### 1. User Action Flow

```
User clicks "Install Package"
    ↓
Renderer: actions.js handleInstall()
    ↓
window.brewAPI.install(packageName)
    ↓
Preload: ipcRenderer.invoke('brew:install')
    ↓
Main: ipcMain.handle('brew:install')
    ↓
spawn('/opt/homebrew/bin/brew', ['install', packageName])
    ↓
Brew executes, streams output
    ↓
Main: collects stdout/stderr
    ↓
Main: logs action to electron-store
    ↓
Main: returns result to renderer
    ↓
Renderer: updates UI, shows notification
```

### 2. Data Flow

```
                    ┌─────────────┐
                    │   Renderer  │
                    │   (UI)      │
                    └──────┬──────┘
                           │
                    Request via IPC
                           │
                    ┌──────┴──────┐
                    │   Preload   │
                    │  (Bridge)   │
                    └──────┬──────┘
                           │
                    Validated Request
                           │
                    ┌──────┴──────┐
                    │    Main     │
                    │  (Node.js)  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Homebrew  │
                    │    CLI      │
                    └──────┬──────┘
                           │
                        Result
                           │
                    (Reverse flow back to Renderer)
```

## Security Model

```
┌─────────────────────────────────────────┐
│      Renderer Process (Sandboxed)      │
│                                         │
│  • No direct Node.js access            │
│  • No file system access               │
│  • No child process spawning           │
│  • Context isolation enabled           │
│                                         │
│  Can ONLY access:                       │
│    window.brewAPI (whitelisted)        │
└─────────────────┬───────────────────────┘
                  │
          Context Bridge
          (One-way API exposure)
                  │
┌─────────────────┴───────────────────────┐
│           Preload Script                │
│                                         │
│  • Runs in privileged context          │
│  • Exposes ONLY safe APIs              │
│  • Validates all requests              │
└─────────────────┬───────────────────────┘
                  │
            IPC Channel
                  │
┌─────────────────┴───────────────────────┐
│        Main Process (Full Access)       │
│                                         │
│  • Can execute brew commands           │
│  • Can access file system              │
│  • Validates all commands              │
│  • Never requests sudo                 │
└─────────────────────────────────────────┘
```

## Component Responsibilities

### Renderer Process (src/renderer/)

**index.html**
- Defines app structure
- Titlebar with sidebar toggle
- Sidebar navigation
- Main content area

**main.css**
- Base styles
- Layout system
- Component styles
- Responsive utilities

**themes/*.css**
- CSS custom properties (variables)
- Theme-specific colors
- Three themes: Night Drive, Overdrive, Steady Cruise

**app.js**
- App initialization
- State management
- Routing system
- Sidebar toggle logic
- Theme switching
- View loading orchestration

**views.js**
- Dashboard rendering
- Installed packages view
- Outdated packages view
- Install/discover view
- Logs view
- Settings view
- Search functionality

**actions.js**
- User action handlers
- Modal dialogs
- API calls via window.brewAPI
- Error handling
- Success notifications

### Preload Script (src/main/preload.js)

**Exposed APIs:**
```javascript
window.brewAPI = {
  // Brew operations
  execute(command, args)
  getInfo()
  getInstalled(type)
  getOutdated()
  search(query)
  getPackageInfo(packageName)
  install(packageName, isCask)
  uninstall(packageName)
  upgrade(packageName)
  update()
  getLogs()
  
  // Progress updates
  onProgress(callback)
  
  // Settings
  settings.get(key)
  settings.set(key, value)
  settings.getAll()
  
  // Notifications
  notification.send(title, body)
}
```

### Main Process (src/main/main.js)

**Window Management:**
- Create BrowserWindow
- Configure titlebar style
- Handle window lifecycle
- DevTools in dev mode

**IPC Handlers:**
- `brew:execute` - Execute any brew command
- `brew:info` - Get Homebrew system info
- `brew:installed` - List installed packages
- `brew:outdated` - List outdated packages
- `brew:search` - Search packages
- `brew:package-info` - Get package details
- `brew:install` - Install package
- `brew:uninstall` - Uninstall package
- `brew:upgrade` - Upgrade packages
- `brew:update` - Update Homebrew
- `brew:logs` - Get command history
- `settings:get/set/getAll` - Manage settings
- `notification:send` - Send system notification

**Helper Functions:**
- `executeBrewCommand()` - Spawn brew process
- `logAction()` - Log operations to store
- `sendNotification()` - Native notifications

## State Management

### Client State (Renderer)
```javascript
state = {
  currentView: 'dashboard',
  sidebarCollapsed: false,
  settings: {...},
  brewInfo: {...},
  loading: false
}
```

### Persistent State (Main - Electron Store)
```javascript
{
  brewPath: '/opt/homebrew/bin/brew',
  autoUpdate: false,
  notifications: true,
  theme: 'night-drive',
  safeMode: true,
  sidebarCollapsed: false,
  lastUpdate: '2025-01-23T00:00:00.000Z',
  logs: [
    {
      timestamp: '...',
      action: 'install',
      target: 'wget',
      success: true,
      error: null
    }
  ]
}
```

## Build & Distribution

```
Source Code
    ↓
electron-builder
    ↓
┌───────────────────────┐
│  Packaged App         │
│  • Bundled resources  │
│  • Code signed        │
│  • Notarized          │
└───────────────────────┘
    ↓
┌───────────────────────┐
│  DMG Installer        │
│  • Drag to Apps       │
│  • macOS native       │
│  • Gatekeeper ready   │
└───────────────────────┘
```

## Performance Optimizations

1. **Lazy Loading**: Views render on-demand
2. **Streaming Output**: Real-time brew output
3. **Debounced Search**: 500ms delay before search
4. **Limited Results**: Max 50 search results displayed
5. **Capped Logs**: Only 100 most recent logs stored
6. **Non-blocking**: All brew operations async
7. **Minimal Dependencies**: Only essential packages

## Error Handling

```
Error occurs in brew command
    ↓
Main process catches error
    ↓
Logs to electron-store
    ↓
Returns error to renderer
    ↓
Renderer displays modal
    ↓
User can view error details
```

## Extension Points

**Adding New Commands:**
1. Add IPC handler in main.js
2. Expose via preload.js
3. Call from renderer

**Adding New Views:**
1. Create render function in views.js
2. Add route in app.js
3. Add nav item in index.html

**Adding New Themes:**
1. Create CSS file in themes/
2. Add to Settings dropdown
3. Update theme switcher

**Adding New Settings:**
1. Add to Settings view UI
2. Save via settings.set()
3. Read via settings.get()
4. Use in main or renderer logic

---

This architecture ensures:
- **Security**: Sandboxed renderer, no direct system access
- **Performance**: Async operations, streaming output
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to add features
- **User Experience**: Native macOS feel, responsive UI
