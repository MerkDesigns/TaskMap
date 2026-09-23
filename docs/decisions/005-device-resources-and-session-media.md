# ADR 005: Device preferences, encrypted camera cache and session media

- Status: Accepted for supporting integration; visible binding pending
- Date: 2026-09-12

## Context

ADR 004 brings database activation forward without a new document/store/render architecture. Retained
device preferences and remembered cameras are not document transactions. Canvas IDs and coordinates,
however, reveal document structure and must not become plaintext configuration. Real image import and
lazy reads need bounded native transport before the atomic visible cutover.

## Decision

Use the existing edition-specific native config directory for two independent resources:

- `device-preferences-v1.json`: strict versioned, revision-checked device preferences. The allowlist is
  default element colors, up to eight recent colors, toolbar visibility, privacy-mode preference and
  dismissed update version. No canvas names/IDs, paths, text or document snapshots. Missing files use
  retained defaults; corrupt/foreign-version files report errors rather than being silently replaced.
- `view-state-{databaseId}.bin`: encrypted device-local remembered cameras. TypeScript owns the strict
  version-1 payload, with at most 256 canvas entries. Rust treats it as opaque bytes (128 KiB maximum)
  and uses the existing unlocked session key and XChaCha20-Poly1305 with a fresh random 24-byte nonce.
  Associated data is `taskmap-device-view-v1|{edition}|{databaseId}`, separate from document/key-check
  domains. Every read/write authorizes captured database/session IDs under the existing session mutex.
  Decrypted Rust responses use the existing zeroizing, redacted wrapper.

Atomic native replacement is shared with existing settings file handling. Neither resource changes
the SQLite envelope or document schema. The camera cache is not portable database content and is not
included in `.tmapdb` full backups or recovery generations: another device starts with default views.
Missing cache means no remembered camera; authentication/format failure is an explicit resource error.
No automatic legacy conversion or keyring lookup is introduced.

The application owns one preference service and one remembered-view cache. Only the existing
interaction controller's settled notification updates remembered cameras; pointer frames never
serialize or persist them. Save-before-lock/close flushes these resources before the document. Failure
retains the unlocked workspace; forced revocation still takes precedence over saving. Session purge
clears camera state, and queued responses cannot repopulate a replaced workspace.

Promote only explicit local-main-window `app_*` resource commands. Image bytes enter through either a
native-owned file picker (no renderer path argument) or 256 KiB chunks bound to the unlocked session.
One upload is staged at a time, bounded to 50 MiB, with token/offset/length checks; idle uploads expire
on the next media request after 60 seconds and are discarded on lock/disposal. Native normalization
reuses the existing image recipe extracted into `image_processing.rs`, also used by legacy imports
and portable validation. GIF/SVG representations and raster normalization constants are unchanged.

Lazy reads validate stored hash/length/format once per load, then return bounded chunks. Native
validation may hold one bounded full image buffer and decode off the renderer thread; this is not a
zero-copy or streaming decoder claim. Application URL leases share in-flight reads, limit concurrency
to two, and revoke on last release/session transition. Media bytes/URLs never enter Redux. Import
registers opaque metadata and inserts the image through one document transaction. Undo preserves media;
failed/stale insertion can leave unreferenced bytes. Destructive media garbage collection is deferred.

Native drop intake added 2026-09-21: an actual local main-window drop issues at most 32 opaque,
one-use tokens in the unlocked session. Tokens expire after 60 seconds and a subsequent drop replaces
the pending set; lock/close discard the session-owned paths. `app_import_dropped_image` accepts only
the token and captured database/session identity, never a renderer path. It redeems under the session
mutex and reuses the existing authorized file-import recipe. Display coordinates are converted from
physical pixels at the native boundary. Filling/replacing an existing image is a separate named,
captured transaction that preserves relationships and rejects stale media/placement/geometry.

## Consequences and acceptance boundary

The new application composition remains unmounted. Production capability registration does not mean
the visible app has switched storage. Batch B must bind preferences/cameras, renderer leases, picker
and drop/clipboard entry points, lifecycle error UI and purge hooks, and disconnect legacy startup and
storage atomically. Native path-only drag/drop needs an authorized native intake rather than passing
arbitrary paths to a generic command; the token intake above now supplies that support. Live
lock/restart/security/media/visual checks remain required.

These decisions add no material strategy, geometry observer, per-pointer persistence path, database
format migration or general App ownership refactor. Existing user data and benchmark files remain untouched.
