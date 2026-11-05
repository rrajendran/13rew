# 13rew — v1.0.0 (Stable)

Release date: 2026-01-25

## Highlights

A modern, native-feeling GUI for Homebrew — stable first major release with a polished UI, improved stability, and core Homebrew management features.

## Features

- Visual Package Management: install, uninstall, and upgrade Homebrew packages from the GUI.
- Real-time Dashboard: system and Homebrew stats (formulae count, cask count, outdated packages) and quick actions.
- Package Discovery: fast search across Homebrew registry.
- Safe Upgrade Flows: preview changes before running upgrade commands.
- Command History: chronological activity logs with success/failure indicators and detailed messages.
- Three Themes: Night Drive, Overdrive, and Steady Cruise (theme persistence supported).
- Sidebar Toggle in Titlebar: native macOS-style titlebar toggle for the sidebar with smooth animation.
- Settings: configure Homebrew path, auto-update preferences, notifications, and safe-mode options.
- Native Performance: macOS-native styling and responsive UI.
- Security: renderer context isolation and confirmation for destructive actions.

## Bug fixes

- Fixed Homebrew detection ("spawn /opt/homebrew/bin/brew ENOENT") — app now auto-detects `brew` on startup and guides users to update the Brew Binary Path if needed.
- Stability improvements and crash fixes related to startup and missing Homebrew installations.
- Various performance and UI polish tweaks across the dashboard, package list, and sidebar animations.

## Upgrade notes

- Requires macOS 12+ and Node.js 18+ for development.
- To build distributable packages, run `npm run build` (creates DMG/archives in `dist/`).

## Leaves

Top-level packages with no parent-level dependencies (leaf nodes in the dependency graph):

- `electron-log` — ^5.0.0
- `electron-store` — ^8.1.0
- `electron-updater` — ^6.1.7
- `vis-network` — ^10.0.2

## Contact

Report issues at https://github.com/rrajendran/13rew/issues

---

Thank you for using 13rew — made with ☕️ for the developer community.
