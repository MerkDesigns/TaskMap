# ADR 007: Custom installer bootstrapper around NSIS

- Status: Accepted
- Date: 2026-10-01

## Context

TaskMap ships as a Tauri NSIS installer. NSIS reliably handles files, the uninstall registry entry,
the uninstaller and the updater's silent reinstall, but its wizard can only be branded, never
designed: it always looks like a classic Win32 setup dialog. The product wants a first-install
experience that matches the app.

## Decision

A separate small Tauri application, the **installer bootstrapper** (`installer/` for Rust,
`src/installer/` for its UI), presents a custom installer UI and runs the unchanged NSIS installer
silently underneath.

- The release build embeds the edition's NSIS `setup.exe` in the bootstrapper binary and ships it as
  `TaskMap_Installer.exe`. Without an embedded payload (development builds), the bootstrapper
  simulates installation so the UI can be developed.
- Installation runs NSIS with `/S /D=<folder>`; updates add `/UPDATE`. NSIS keeps owning files,
  registry, the uninstaller and file associations, so installs are identical to what the in-app
  updater produces. The updater keeps using plain NSIS; the bootstrapper is only for first installs
  and manual updates.
- Installs are per-user (NSIS `currentUser`), with no elevation prompt.
- NSIS can only disable both shortcuts at once (`/NS`), so the bootstrapper installs without them and
  creates the chosen Start Menu/Desktop shortcuts itself, natively (COM `IShellLinkW`), at the paths
  the NSIS uninstaller removes.
- The bootstrapper never runs shell interpreters (`cmd`, PowerShell) or elevates; it launches only the
  extracted NSIS installer and the installed TaskMap executable. Hidden shells are what made antivirus
  heuristics flag the legacy app.
- Existing installations are detected from NSIS's uninstall registry key (`DisplayVersion`,
  `InstallLocation`, `MainBinaryName`).
- Its UI reuses TaskMap's theme tokens, primitives and the halftone pattern, follows the same
  platform rule (only `src/platform/` imports Tauri) and uses no TaskMap glass materials; its
  title bar has one plain backdrop blur, the only allowed direct `backdrop-filter` outside the
  material system.

Out of scope for the first version: a custom uninstaller UI (Windows' uninstall entry points at the
NSIS uninstaller), choosing file associations, and all-users installs.

## Consequences

- Release builds become two-step: build the NSIS installer, then the bootstrapper embedding it.
- The bootstrapper needs WebView2 for its UI. Windows 11 always has it; a future fallback can run the
  embedded NSIS installer with its own wizard where WebView2 is missing.
- A self-extracting executable that runs an embedded installer is a pattern antivirus heuristics
  watch for, so both executables must be code-signed before public release.
- Progress during install is stepped, not measured: silent NSIS reports no progress, and a TaskMap
  install takes a few seconds.
