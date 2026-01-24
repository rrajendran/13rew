# 13rew ☕️

> **Vibe‑Code / Build Spec**\
> A modern, native‑feeling GUI for Homebrew — fast, safe, and developer‑friendly.

---

## ✨ Product Vibe

**13rew** feels like:

- A macOS‑native utility (not a web app in a shell)
- Calm, confident, and transparent
- Power without intimidation

Think: *Activity Monitor* × *Homebrew* × *Raycast polish*.

---

## 🎯 Product Intent

- Make Homebrew **visual and discoverable**
- Reduce mental load of CLI memorisation
- Provide **confidence** before running destructive commands
- Stay out of the way when not needed

---

## 🧑‍💻 Target Users

- Developers managing many tools
- Power users who prefer GUI + terminal hybrid
- Beginners learning Homebrew safely

---

## 🧱 Core App Structure

```
Titlebar
 ├─ macOS traffic lights (left)
 ├─ Sidebar Toggle Button (right of traffic lights)
 └─ App Title / Context

Sidebar
 ├─ Dashboard
 ├─ Packages
 │   ├─ Installed
 │   ├─ Outdated
 │   └─ Available
 ├─ Install
 ├─ Logs
 └─ Settings

Main Content Area
 └─ Contextual views
```

---

## 🎛 Sidebar Behavior (Key UX Detail)

### Toggle Button

- Positioned **inside the titlebar**
- Located **immediately to the right of macOS traffic light buttons**
- Always visible

### Behavior

- Click → collapse / expand sidebar
- Smooth animation (200–250ms)
- Sidebar state persists across restarts

### When Collapsed

- Icons only
- Tooltips on hover

### Icon Suggestions

- Sidebar toggle: `sidebar`, `panel-left`, or custom glyph

---

## 🖥 Dashboard View

**Purpose:** Instant system clarity

Displays:

- Homebrew version
- Formulae count
- Casks count
- Outdated packages
- Last `brew update` time

Visuals:

- Small stat cards
- Neutral colors
- No charts unless useful

---

## 📦 Package Management

### Installed Packages

- List view
- Search + filter
- Sort by name, install date, type

Each package shows:

- Name
- Installed version
- Status (up‑to‑date / outdated)

Click → Package Detail Panel

---

### Package Detail View

- Description
- Installed vs latest version
- Dependencies
- Install path
- Formula / Cask type

Actions:

- Upgrade
- Uninstall
- Pin (phase 2)

---

## 🔍 Discover & Install

- Search Homebrew registry
- Clear install CTA
- Formula / Cask clearly labeled

Install flow:

1. Preview command
2. Confirm
3. Show progress + logs

---

## ⬆️ Update & Upgrade Flow

- `brew update` (metadata refresh)
- `brew upgrade` (all or selected)

UX Rules:

- Always show **what will change** before running
- Highlight breaking or major upgrades

---

## 🧾 Logs & Activity

- Chronological command history
- Timestamped
- Status indicators (success / fail)

Actions:

- Copy output
- Export logs

---

## 🖥 Embedded Terminal

- Read‑only by default
- Streams live `brew` output

Advanced Mode:

- Optional interactive terminal
- Explicit user opt‑in

---

## ⚙️ Settings

- Brew binary path
- Auto‑update toggle
- Notifications
- Safe / Advanced mode
- Theme (Light / Dark / System)
- Create themes separate css files
Palette 1: "Night Drive" (High-Performance Dark Mode)This palette is inspired by the dashboard of a sports car at night. It is dark, sleek, and uses high-contrast neon accents to draw focus to actionable elements. It’s excellent for developer tools, media apps, or anything requiring long periods of intense focus.Vibe: Sleek, technical, futuristic, focused.RoleColor UsedHex CodeDescriptionBackground Deep#0D1117The deepest background layer (the "road").Background Surface#161B22Used for sidebars, cards, or elevated surfaces.Primary Action#2F81F7An electric blue for main buttons and active states.Accent/Highlight#3FB950A vibrant green for success states or secondary highlights."Redline" Accent#F85149Used for destructive actions, errors, or urgent alerts.Text High Contrast#F0F6FCMain text color. Off-white so it isn't jarring.Text Muted#8B949ESecondary text, labels, and subtitles.
Palette 2: "Overdrive" (High Energy & Modern)This is a bolder, more aggressive palette for apps that want to feel fast and disruptive. It uses a very dark purple-tinted grey base with high-voltage magenta and cyan accents. This works well for crypto apps, modern communication tools, or creative software.Vibe: Energetic, disruptive, electric, youthful.RoleColor UsedHex CodeDescriptionBackground#121218A near-black with a very subtle purple undertone.Surface/Card#1E1E2ASlightly lighter for panels and inputs.Primary "Drive"#D946EFA striking fuchsia/magenta for the main call-to-action.Secondary "Turbo"#06B6D4A bright cyan for toggles, accents, and progress bars.Neutral Border#2D2D3FFor subtle dividers and outlines.Text Main#FFFFFFPure white for maximum punch against the dark bg.
Palette 3: "Steady Cruise" (Professional Productivity - Light Mode)Not all "drive" has to be fast and dark. This palette interprets "drive" as steady, reliable forward momentum. It is a clean light mode palette designed for productivity apps (CRMs, project management, writing tools) where clarity is paramount.Vibe: Professional, clear, reliable, efficient.RoleColor UsedHex CodeDescriptionBackground App#F3F4F6A cool light grey base.Surface White#FFFFFFPure white for cards and main content areas.Primary Focus#0F766EA deep, confident teal. Professional but active.Secondary Action#EAB308An amber/mustard yellow for highlights or warnings.Text Primary#111827A very dark charcoal (almost black) for readability.Text Secondary#6B7280A mid-tone grey for less important info.

---

## 🧠 UX Principles

- Never surprise the user
- Always preview commands
- Errors should be actionable
- Respect muscle memory

## Electron Framework Notification

- Success Updates
- Failure Updates
- New version available

---

## 🏗 Technical Vibe

### Stack

- Electron.js
- Node.js (main process)
- React / Vue / Svelte (renderer)

### Architecture

- Renderer = UI only
- Main process = system access
- IPC = strictly typed + minimal

---

## ⚠️ Security Rules

- No password storage
- No silent sudo
- Explicit confirmation for destructive actions
- Sandboxed renderer

---

## 🚀 Performance Expectations

- App launch < 2s
- Non‑blocking UI
- Lazy load package lists

---

## 📦 Distribution

- macOS notarised builds
- DMG + ZIP
- Auto‑update via GitHub Releases
- configure icon in assets/icons/mac

---

## 🧭 Phase Roadmap

### MVP

- Dashboard
- Installed packages
- Install / uninstall
- Sidebar toggle in titlebar

### v1.0

- Upgrade flows
- Logs
- Embedded terminal

### v2.0

- Brew service management
- Dependency graph vizualizer
- Brewfile import/export
- Menubar app mode - minimalist ui - show notifications only like upgrade available, total packages installed, outdated packages

### v3.0+
 - Service management UI (start/stop/restart Homebrew services with logs and health checks)
 - Interactive dependency graph explorer (expand/collapse dependencies, filter by depth)
 - Brewfile import/export with dry‑run and conflict resolution
 - Menubar / background agent mode with optional auto‑update checks
 - Package pinning and version rollback (transactional where possible)
 - Bulk operations with progress & per‑item retry (batch upgrade/uninstall)
 - Brewfile / manifest sync for reproducible environments (exportable manifest)
 - Plugin / extension system (third‑party UI plugins with strict sandboxing)
 - Offline cache / artifact staging for air‑gapped installs
 - Scheduled updates and background maintenance (configurable schedules)
 - Differential update support (smaller downloads via delta updates)
 - Signed/Notarized releases automation + CI integration (release channels: stable/beta/canary)
 - Multi‑arch packaging (universal mac builds + explicit arm64/x64 targets)
 - First‑class cask UI (media apps, binaries, and macOS installer packages handling)
 - Better `brew info` parsing and rich detail panes (changelogs, caveats)
 - GUI conflict resolver for formulae/tap collisions
 - Localization (i18n) and accessibility improvements (ARIA, keyboard navigation)
 - Opt‑in telemetry and usage diagnostics (clear consent + privacy controls)
 - Windows / Linux support (platform‑specific packaging and CLI integrations)


## 🏁 Success Signals

- Fewer terminal errors
- Faster package discovery
- Users trust before running commands

---

**Status:** Vibe‑Code Ready\
**Audience:** Builders, Designers, OSS Contributors

