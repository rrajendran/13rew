brew update: referenced in the update confirmation/modal and called via window.brewAPI.update() — actions.js:5
brew upgrade <pkg> / brew upgrade (all): used via window.brewAPI.upgrade(...) — actions.js:152
brew install <pkg> and brew install --cask <pkg>: used by install flows and Brewfile import — main.js:332 and actions.js:500
brew uninstall <pkg> (remove): via window.brewAPI.uninstall(...) — actions.js:330
brew info <pkg> and brew info --json=v2: used for package info and dependency graph — main.js:277
brew list --formula and brew list --cask (and general brew list): used for Brewfile export and status counts — main.js:298
brew outdated (and --json/--json=v2): used to find outdated packages — main.js:186 and actions.js:32
brew search <query>: used by the search API — main.js:412 and window.brewAPI.search() — actions.js:500
brew services <list|start|stop|restart>: managed via services API (executeBrewCommand('services', [...])) — main.js:252
brew deps --tree <formula>: used for dependency tree — main.js:263
brew link --overwrite <pkg>, brew link <pkg>, brew unlink <pkg>: surfaced in upgrade error handling and executable actions (brewAPI.execute('link', ...)) — actions.js:627
brew --version: used when building status info — main.js:142
Brewfile format lines brew "name" and cask "name" are generated/consumed by the Brewfile export/import flow (imports map back to brew install / brew install --cask) — main.js:298 and actions.js:436
