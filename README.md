# 13rew ☕️

A modern, native-feeling GUI for Homebrew — fast, safe, and developer-friendly.

![macOS](https://img.shields.io/badge/macOS-12%2B-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Electron](https://img.shields.io/badge/Electron-28-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🎯 **Visual Package Management** - Install, uninstall, upgrade packages with a click
- 📊 **Real-time Dashboard** - System stats and quick actions at a glance
- 🔍 **Package Discovery** - Search Homebrew's entire registry instantly
- ⬆️ **Safe Upgrade Flows** - Preview changes before running commands
- 📝 **Command History** - Track all operations with detailed logs
- 🎨 **Three Beautiful Themes** - Night Drive, Overdrive, Steady Cruise
- 🔒 **Security First** - No passwords, always confirm destructive actions
- ⚡ **Native Performance** - macOS-native UI, fast and responsive
- 🎛️ **Sidebar Toggle** - Positioned in titlebar, just like native macOS apps

## 🚀 Quick Start

### Prerequisites

- macOS 12 (Monterey) or later
- Node.js 18+
- Homebrew installed

### Installation

```bash
# Clone or download this repository
cd 13rew

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or run in production mode
npm start
```

### Build for Distribution

```bash
npm run build
```

Creates a DMG file in the `dist/` folder.

## 🎨 Themes

Choose from three carefully crafted themes:

### Night Drive (Default)
High-performance dark mode inspired by sports car dashboards. Perfect for long coding sessions.

### Overdrive  
High-energy dark theme with electric purple and cyan accents. For bold interfaces.

### Steady Cruise
Professional light mode for productivity. Clear, calm, and focused.

**Switch themes:** Settings → Theme dropdown

## 📖 Documentation

- **[Getting Started](GETTING_STARTED.md)** - Setup, first launch, and basic usage
- **[Development Guide](DEVELOPMENT.md)** - Contributing and customization
- **[Architecture](ARCHITECTURE.md)** - Technical architecture and design
- **[Quick Reference](QUICK_REFERENCE.md)** - Commands and common tasks
- **[Design Spec](13rew.instructions.md)** - Original product specification

## 🎯 Key Features Explained

### Dashboard
Real-time Homebrew statistics with formulae count, cask count, outdated packages, and quick actions for common tasks.

### Package Management
- **Installed**: Browse and search all installed packages
- **Outdated**: See what needs updating with version comparison
- **Install**: Search and install from Homebrew's registry

### Sidebar with Titlebar Toggle
The sidebar toggle button is positioned **inside the titlebar**, right next to macOS traffic lights - just like native macOS apps. Click to collapse/expand with smooth animation.

### Activity Logs
Chronological history of all operations with success/failure indicators and detailed error messages when needed.

### Settings
Configure Homebrew path, enable auto-updates, toggle notifications, choose themes, and set safe mode preferences.

## 🏗️ Tech Stack

- **Electron.js** - Desktop app framework
- **Node.js** - Main process and system access
- **Vanilla JavaScript** - No framework overhead
- **Electron Store** - Settings persistence
- **Native macOS styling** - Feels like a native app

## 🔒 Security

- Context isolation enabled
- No Node.js access in renderer
- No password prompts or storage
- User confirmation for destructive actions
- Sandboxed renderer process

## 🎯 Target Users

- Developers managing many tools
- Power users who prefer GUI + terminal hybrid
- Beginners learning Homebrew safely

## 📦 Building & Distribution

The app can be packaged as a DMG for distribution:

1. **Build**: `npm run build`
2. **Code Sign**: Add Developer ID certificate (optional)
3. **Notarize**: Submit to Apple for Gatekeeper (optional)

See [Getting Started](GETTING_STARTED.md) for detailed instructions.

## 🐛 Troubleshooting

### Error: spawn /opt/homebrew/bin/brew ENOENT

This means Homebrew is not found at the expected location. The app now auto-detects brew on startup!

**Find your brew location:**
```bash
which brew
```

**Common locations:**
- Apple Silicon Mac: `/opt/homebrew/bin/brew`
- Intel Mac: `/usr/local/bin/brew`
- Homebrew not installed? Install from [brew.sh](https://brew.sh/)

**If auto-detection fails:**
1. Launch the app
2. Go to Settings (ignore any errors)
3. Update "Brew Binary Path" with your actual path
4. Refresh the app

### Can't find Homebrew?
Update the brew path in Settings:
- Apple Silicon: `/opt/homebrew/bin/brew`
- Intel Mac: `/usr/local/bin/brew`
- Run `which brew` to find your exact path

### npm install fails?
Delete `node_modules` and try again:
```bash
rm -rf node_modules
npm install
```

### App won't launch?
Check Node.js version:
```bash
node --version  # Should be v18+
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

See [DEVELOPMENT.md](DEVELOPMENT.md) for technical details.

## 📝 License

MIT License - see package.json for details

## 🎉 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Inspired by macOS native utilities
- Powered by [Homebrew](https://brew.sh/)

---

**Status:** MVP Ready  
**Version:** 0.1.0  
**Platform:** macOS 12+

Made with ☕️ for the developer community
