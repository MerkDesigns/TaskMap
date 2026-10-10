# Changelog

User-visible changes to TaskMap, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Development history lives in Git commits
and pull requests.

## Unreleased

Architecture v1 (`architecture-v1`), not yet released.

### Added

- Legacy migrator (`npm run migrate-legacy`): turns a TaskMap 0.3 export file into a new TaskMap
  database with a password you choose, and reports anything that could not come across.
- Workflow extension for text cards, replacing the old Command Runner: in a movable, resizable
  window you type one command per line (`npm run dev`, `a && b`, `start http://localhost:3000`),
  with an optional working directory and a terminal window or the background. The Command Runner's
  play button before the card's text starts all lines, spins while they run and stops everything
  they started. TaskMap reads the commands itself instead of handing them to a shell, so pipes,
  redirects and `%VARIABLES%` are not supported, and nothing runs as administrator. Workflows you
  write are trusted on this PC; one that comes from elsewhere is shown for review before it can run.
- Encrypted `.tmapdb` databases: a password protects canvas content (Argon2id + authenticated
  encryption); images and GIFs are stored unencrypted for performance.
- Unlock screen that opens the most recent database directly, with a recent-database list, Caps
  Lock indicator and password reveal toggle.
- A custom installer (`TaskMap_Installer.exe`) with install, update and finish screens; it runs the
  standard installer silently, installs per user without an admin prompt and creates only the
  shortcuts you choose. It never replaces the legacy TaskMap (0.3.x); the new app installs alongside
  it as **TaskMap Beta**.
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

- Notifications use the same glass as the toolbars, slide in and out without the blur dropping
  out, and sit below the window controls instead of covering them.
- The minimap pans the canvas: press anywhere on it to jump there, or drag its viewport frame. It
  stays visible while the pointer is over it, and its background is see-through like the Canvas
  Browser previews.
- Unlocking is much faster (about 0.15 s from Unlock to workspace on a typical database).
- The Canvas Browser opens automatically after unlocking.
- Closing the window keeps TaskMap running in the tray (unlocked, reopens without the password),
  with a tray icon offering Open and Quit. Settings → Database can switch closing to quit instead,
  lock and quit after 15 minutes, 1 hour or 4 hours in the tray, and adds a Quit TaskMap button.
- Settings: Lock database and Close database share one island, Check for updates sits at the
  bottom of the Misc tab, and "Shadows below elements" is renamed "Canvas-only shadows".

### Fixed

- Text cards scrolled up in a container stay under its header; a card on a high layer used to be
  drawn over the title and search row.
- Shift-resizing an element snaps its width and height together, so it can match one neighbour's
  width and another's height in one drag; it used to snap only one edge at a time.
- The minimap stays visible for as long as you pan the canvas, and fades out only after the pan
  ends; it used to disappear two seconds into a longer pan.
- Pressing a container's or text block's menu button again closes its menu instead of reopening it.
- The JSON editor and workflow windows fade their glass in and out again; the glass stayed
  transparent for the whole fade and then appeared at once.
- Selecting text in a field outside the canvas (such as the JSON editor) no longer jumps to the wrong
  lines when the pointer is dragged out over the canvas.
- TaskMap checks for updates again when a database opens; the automatic check at startup had
  stopped running.
- A settings file written by a newer TaskMap, or a damaged one, no longer stops a database from
  opening: newer settings are ignored and a damaged file is kept as a `.bak` copy.
- Text cards inside containers keep their shadows when "Canvas-only shadows" is on.
- Mind-map nodes can be dragged again.
- Containers and text blocks follow the pointer while being moved or resized again, instead of
  jumping into place on release.
- Containers, text blocks, images, text cards and mind-map nodes look exactly the same while dragged
  and after being placed:
  nested borders no longer shimmer, and the header title, icon and search bar no longer shift by
  a pixel on drop.
- Containers, text blocks and images are sharp again right after zooming, instead of staying
  blurry until touched.
- A checked text-card checkbox has a darker fill, so the check mark stands out instead of the box
  lighting up.

### Removed

- Discord Rich Presence, daily reset, sorting, pick-a-card, the old raw Command Runner and the
  production frosted-glass tuner.
- Keyring-based encryption and legacy data migrations inside the app.
- WebView2's built-in autofill and password saving in the app window.
- The browser features the app window inherited from Edge: Ctrl+P printing, Ctrl+S saving the
  page, the find bar, reload, back/forward, caret browsing, DevTools keys, pinch zoom, swipe
  navigation, the link status bar and links opening new windows. Edge's right-click menu is gone
  outside text fields; in text fields it keeps only Cut, Copy, Paste and Select all.
- The old password-protected data export/import and the "Reset local data" recovery button; they
  relied on the pre-database storage and no longer worked.
