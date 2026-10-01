# Changelog

User-visible changes to TaskMap, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Development history lives in Git commits
and pull requests.

## Unreleased

Architecture v1 (`architecture-v1`), not yet released.

### Added

- Encrypted `.tmapdb` databases: a password protects canvas content (Argon2id + authenticated
  encryption); images and GIFs are stored unencrypted for performance.
- Unlock screen that opens the most recent database directly, with a recent-database list, Caps
  Lock indicator and password reveal toggle.
- Animated halftone background behind the unlock screen: accent-coloured dots that grow and shrink
  with slowly flowing noise (a still frame when reduced motion is on).
- Unlock and lock animations: the workspace is revealed with a zoom-and-fade and covered again on
  lock.
- Sleep mode: toolbars and window controls hide after a configurable period of inactivity and return
  on activity, together with the side panel.
- Settings → Visual → Interface: per-device corner radii for panels, cards, the top bar and Settings,
  plus the sleep delay.
- Native glass UI across panels, dialogs and lists, including rounded scroll-edge slicing.

### Changed

- Unlocking is much faster (about 0.15 s from Unlock to workspace on a typical database).
- The Canvas Browser opens automatically after unlocking.
- Settings: Lock database and Close database share one island, Check for updates sits at the
  bottom of the Misc tab, and "Shadows below elements" is renamed "Canvas-only shadows".

### Fixed

- Text cards inside containers keep their shadows when "Canvas-only shadows" is on.

### Removed

- Discord Rich Presence, daily reset, sorting, pick-a-card, the old raw Command Runner and the
  production frosted-glass tuner.
- Keyring-based encryption and legacy data migrations inside the app.
- WebView2's built-in autofill and password saving in the app window.
