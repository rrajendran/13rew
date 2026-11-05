# 13rew — v1.1.0

Release date: 2026-02-22

## What's new

### Leaves view
A new **Leaves** section has been added to the sidebar under the _Packages_ group. Clicking it runs `brew leaves` and lists every top-level Homebrew package — i.e. packages that nothing else depends on. Each entry has quick-action buttons: **Info**, **Upgrade**, and **Uninstall**, consistent with the rest of the package views.

## Bug fixes

- **`window.brewAPI.update is not a function`** — The auto-updater IPC bridge was registered under the key `update`, which silently overwrote the `update()` brew-command function. The auto-updater namespace has been renamed to `appUpdate` across `preload.js`, `app.js`, and `views.js`, so `brewAPI.update()` (run `brew update`) and `brewAPI.appUpdate` (electron auto-updater) no longer conflict.

- **Upgrade progress shows wrong package name** — When upgrading packages, the progress parser sometimes emitted numeric-only strings (e.g. `"1"` or `"1/23"`) as the current package name. The regex match now filters candidates to only those containing at least one letter, so the upgrade progress indicator always shows a real package name. Fixed in both `brew-api.js` and `menubar.js`.

## Improvements

- Added `publish:all` build script (`electron-builder -mwl --publish always`) for simultaneous multi-platform (macOS / Windows / Linux) release publishing.

## Leaves

Top-level Homebrew packages with no dependents (`brew leaves`):

- `automake`
- `awscli`
- `bash`
- `bower`
- `cffi`
- `cliclick`
- `cmake`
- `consul-template`
- `curl`
- `derailed/k9s/k9s`
- `docker-compose`
- `docutils`
- `dos2unix`
- `exiftool`
- `ffmpeg`
- `gawk`
- `gemini-cli`
- `gh`
- `git`
- `git-filter-repo`
- `git-lfs`
- `gobject-introspection`
- `graphviz`
- `guile`
- `hashicorp/tap/vault`
- `helm`
- `imagemagick`
- `jq`
- `kube-ps1`
- `libass`
- `libjwt`
- `librist`
- `liquibase`
- `meson`
- `mike-engel/jwt-cli/jwt-cli`
- `minio/stable/mc`
- `nghttp2`
- `node@24`
- `nvm`
- `oath-toolkit`
- `openjdk@17`
- `openvino`
- `p7zip`
- `pgcli`
- `pgformatter`
- `pnpm`
- `podman`
- `poppler`
- `portaudio`
- `postgresql@14`
- `postgresql@15`
- `proctools`
- `pyenv`
- `pyqt`
- `python-tabulate`
- `python@3.10`
- `python@3.11`
- `python@3.12`
- `python@3.8`
- `python@3.9`
- `qemu`
- `qpdf`
- `re2`
- `rename`
- `restic`
- `rpm`
- `ruby`
- `rust`
- `shfmt`
- `sox`
- `sqlparse`
- `sshpass`
- `steipete/tap/remindctl`
- `superbrothers/zsh-kubectl-prompt/zsh-kubectl-prompt`
- `tesseract`
- `theseal/ssh-askpass/ssh-askpass`
- `tidy-html5`
- `toilet`
- `tree`
- `watch`
- `wget`
- `yakitrak/yakitrak/obsidian-cli`
- `yarn`
- `zsh`
- `zsh-autosuggestions`

## Contact

Report issues at https://github.com/rrajendran/13rew/issues

---

Thank you for using 13rew — made with ☕️ for the developer community.
