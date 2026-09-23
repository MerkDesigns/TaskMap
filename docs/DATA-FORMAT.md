# TaskMap Database Format

## Overview

A TaskMap database is one SQLite file with the `.tmapdb` extension. The TypeScript document is encrypted; media bytes are intentionally plaintext for later lazy/streaming access. Database format version and decrypted document schema version are independent.

Version 1 uses SQLite `STRICT` tables, rollback-journal `DELETE` mode, `synchronous=FULL`, and in-memory SQLite temporary storage. Document plaintext is never supplied to SQLite, so the active database, rollback journal, recovery rows, and online backups contain only authenticated ciphertext. Media remains plaintext everywhere it is copied.

## Decrypted document schema version 1

TypeScript owns the one canonical current-version document. The JSON object is strict at every
defined record boundary and has this normalized shape:

```text
schemaVersion = 1
id = "document-<canonical lower-case UUID>"
databaseId = "database-<canonical lower-case UUID>"
databasePurpose = "production" | "development"
activeCanvasId = CanvasId | null
canvasOrder = CanvasId[]
canvases = Record<CanvasId, {
  id, name,
  settings: { width, height },
  elementOrder: ElementId[]
}>
elements = Record<ElementId, {
  id, canvasId, type,
  geometry: { x, y, width, height },
  data: JsonObject
}>
connections = Record<ConnectionId, {
  id, canvasId, type,
  source: { elementId, portId },
  target: { elementId, portId },
  data: JsonObject
}>
mediaReferences = Record<MediaId, {
  id, mimeType, byteLength, pixelWidth, pixelHeight, altText
}>
extensionInstallations = Record<ExtensionInstanceId, {
  id, extensionId, target, enabled, configuration: JsonObject
}>
documentSettings = {
  grid: { style, opacityPercent: { dots, lines } },
  showElementShadows,
  allowLockedElementDeletion,
  minimapEnabled
}
```

`canvasOrder` is the stable canvas order. Each canvas's `elementOrder` is its complete back-to-front
layer order; every element appears exactly once in the order of its owning canvas. Connections and
both endpoints must share a canvas. A non-empty document has exactly one existing active canvas; an
empty document has `activeCanvasId = null`.

Element `type`/`data`, connection `type`/`data`, and extension `extensionId`/`configuration` are
generic module boundaries. The generic document validator checks only JSON safety and shared
references; element and extension modules add their own schemas in later phases. The document does
not import either registry and does not enumerate future element implementations.

Media references contain opaque 24-character base64url IDs and presentation/integrity metadata
only. They never contain bytes, original local paths, or original filenames. Document values contain
no `Date`, `Map`, `Set`, class, function, symbol, bigint, `undefined`, non-finite number, sparse array,
or cyclic reference.

The schema intentionally contains no document timestamps or legacy migration fields. Window state,
recent database paths, theme/update choices, inactivity settings, viewport interaction state, and
other application/device/session preferences remain outside the decrypted document.

During the transitional legacy production phase, settled pan/zoom may still be synchronized to the
active legacy `TaskCanvas` solely to preserve remembered per-canvas camera behavior. This is not a
`TaskMapDocument` field or conversion rule. Selection, interaction previews, snap guides, culling
sets, and minimap projections are never document data.

Undo/redo history is session-only application state and is not serialized into the decrypted
document or any SQLite table. History entries contain only in-memory Immer forward/inverse patches
plus non-sensitive transaction metadata. Durable history would require a later explicit
architecture decision.

Backend revision, workspace epoch, local-change and acknowledged-persisted sequences, dirty state,
save phase, sanitized persistence errors, revision-conflict status, scheduled timers, and in-flight
save state are also application/session metadata. None is a `TaskMapDocument` field or encrypted
document payload field. The backend revision remains envelope metadata used as the expected-revision
predicate for saves.

Structural parsing enforces exact fields, scalar shapes, ID formats, JSON safety, and conservative
limits. Semantic validation then checks normalized keys, ordering completeness and uniqueness,
active-canvas validity, ownership, connection locality, and extension target references. No legacy
shape is defaulted or migrated by the parser.

The conservative TypeScript limits are 256 canvases, 20,000 elements, 40,000 connections, 20,000
media references, 40,000 extension installations, 256-character canvas names, 128-character type
identifiers, 1 MiB per generic JSON string, 20,000 entries per generic JSON container, 32 levels,
and 250,000 JSON nodes. The encrypted document's separate 64 MiB envelope limit still applies.

## Staged card/container payload contracts

Database intermission step 3b1 defines these strict module-owned payloads for fresh current-version
documents. They are not legacy conversion rules, harness defaults, or a claim that generic document
validation proves feature renderability. The generic envelope and Rust database format are unchanged.

- `type: "container"`: `data = { name: string, accent: string, headerButtonsVisible: boolean }`.
- `type: "text-card"`: `data = { text: string, accent: string, link: string | null,
placement: { containerId: ElementId, order: integer } | null }`.

Every field is explicit; no parser defaults, trimming or unknown fields. Text, name, accent and link
use the generic string limit; accent must be nonempty. Empty names/text/links remain valid.
Null placement denotes a root card; otherwise its parent must be a valid container on the same canvas.
Child-owned placement is the sole membership/order authority: containers have no redundant child IDs.
Order is a nonnegative integer below the element-count limit, unique within that container; gaps are
allowed. Cards and images share this placement rule and the same child-order validation.
`canvas.elementOrder` remains the complete layer order, independent of child list order.

Geometry stays in the element envelope. Retained card views consume x/y but remain content-sized;
their measured layout must not overwrite canonical width/height during a translation. Extensions
remain separate installations, never embedded legacy extension objects or raw workflow strings.
These schemas and the unmounted projection do not yet guard generic commands or pending confirmation.
Full typed feature admission/transaction validation is required before the later editable UI cutover.

## Staged text-block and mind-map contracts

Intermission step 3b2 adds these strict module-owned payloads without changing the generic envelope:

- `type: "text-block"`: `data = { name: string, text: string, accent: string,
headerButtonsVisible: boolean }`. Name/text may be empty; accent is nonempty; strings use the
  generic string limit. Width/height come only from canonical geometry.
- `type: "mind-map-node"`: `data = { text: string, accent: string }`. Text may be empty; accent is
  nonempty; strings use the generic limit. Nodes are root and content-sized, with no link/placement
  payload. The retained view's `kind: "mindmap"` is a presentation mapping, not persisted data.
- Connection `type: "mind-map"`: `data = {}`; each endpoint requires a non-null port from
  `left | right | top | bottom`. No unknown endpoint/data fields or implicit default ports.

Connections require distinct, valid, connectable elements on the connection's owning canvas. One
connection per unordered element pair is allowed, regardless of direction/ports. This preserves the
retained application's rule, not a new restriction to node-to-node edges. Containers, text blocks and
mind-map nodes are supported endpoints in 3b2; ordinary text cards are not. Images must join this
capability set when their typed payload/media projection is implemented, not be silently discarded.
Feature validation remains staged and unmounted; it is not yet a generic command or unlock gate.

## Staged image and media-reference contracts

Intermission step 3b3 adds `type: "image"` with strict
`data = { mediaId: MediaId | null, accent: string, background: boolean, placement: ContainerPlacement }`.
All fields are explicit. Accent is nonempty and uses the generic string limit. Placement is the same
child-owned nullable contract as cards; cards and images cannot reuse an order within one container.
The shared schema lives in `domain/document/elementPlacement.ts`, outside the generic envelope parser.
Images, including empty placeholders, are connectable under the existing same-canvas/pair rules.

Null `mediaId` denotes an empty image placeholder. A non-null ID must resolve to valid image metadata;
missing/invalid references are errors, never silently downgraded to empty placeholders. Data contains
no legacy hash, format, natural dimensions, filename, URL, bytes or embedded extensions.

Image metadata uses the existing `MediaReference` record with positive byte length and stored MIME
`image/webp | image/gif | image/svg+xml`. This matches retained storage: raster input is normalized to
WebP, while GIF/SVG retain their representation. It is not a promise that arbitrary MIME strings or
unprocessed PNG/JPEG payloads can enter the new active media path. Intrinsic dimensions must either
both be positive bounded integers or both be null (unknown); no aspect ratio is guessed. Alt text
remains encrypted metadata. These checks do not verify bytes, SVG safety or actual decoder support;
bounded Rust transport/import and byte/resource validation remain step 4.

Read-only image projections expose `media: ImageMediaMetadata | null`, preserve canonical geometry,
background and placement, and derive optional natural dimensions from that reference. They never
populate the legacy `imageId`/`format` fields or create a source URL. All references, including unused
ones, are validated and retained in the projection result. Invalid unsupported metadata yields no
partial view. The future renderer binding must distinguish empty/loading/failed states and use the
session-bound media service; these metadata props alone are not a complete ImageNode integration.

## Staged retained-extension contracts

Intermission step 3b4 adds the following strict configuration schemas to the existing architecture
extension registry. All support element targets only; no canvas/document scope is silently remapped.

| Canonical extension ID | Configuration          | Compatible canonical element types                     |
| ---------------------- | ---------------------- | ------------------------------------------------------ |
| `privacy`              | `{ enabled: boolean }` | container, text-block                                  |
| `lock`                 | `{ enabled: boolean }` | container, text-block, text-card, mind-map-node, image |
| `color-picker`         | `{ enabled: boolean }` | container, text-block, text-card, mind-map-node        |
| `checkbox`             | `{ checked: boolean }` | text-card                                              |
| `search`               | `{ query: string }`    | container                                              |
| `auto-checkbox`        | `{ enabled: boolean }` | container                                              |
| `counter`              | `{ enabled: boolean }` | container                                              |
| `inherit-card-color`   | `{ enabled: boolean }` | container                                              |
| `copy-paste-json`      | `{ enabled: boolean }` | container                                              |

Fields are required, unknown keys rejected, and values are not coerced or defaulted during parsing.
New-install defaults are true for flags, false for checkbox, and empty query. Search preserves all
whitespace/Unicode and uses the existing generic JSON string limit. These nine declare no mutual
conflicts; one installation per ID/target is allowed, even when disabled. Removed extensions and raw
Command Runner are unsupported; this does not implement or authorize the later structured Workflow Runner.

Installation `enabled` is the activation gate, distinct from configuration `enabled`. A disabled
installation contributes no effective element props but retains its validated configuration in the
projection metadata. An active installation with a false configured flag remains installed-but-off,
preserving retained lock/privacy controls. Disabled entries still undergo schema and target validation.
The temporary view maps kebab-case IDs to existing camel-case prop names, never to raw workflow props.

Definitions/projected state are read-only staged support, not mounted feature controls or commands.
The generic envelope remains unchanged. Step 3c1 supplies these feature-data checks at the unmounted
product transport/workspace admission and candidate-publication boundaries. Action-specific command
rules and callback guards still precede editable startup. No legacy conversion or database
schema-version bump is introduced.

## Version 1 limits

The reader checks structure and lengths before fetching variable-size BLOBs or invoking Argon2:

- KDF: exactly Argon2id v0x13, 65,536 KiB, 3 iterations, 1 lane, 32-byte output
- Salt: exactly 16 bytes
- Cipher: exactly XChaCha20-Poly1305
- Nonce: exactly 24 bytes
- Database ID: `database-` plus a canonical lower-case UUID, exactly 45 UTF-8 bytes
- Password: 1 through 1,024 UTF-8 bytes
- Decrypted document: 1 byte through 64 MiB
- Document ciphertext: 16 bytes through 64 MiB plus the 16-byte AEAD tag
- Development media record: at most 64 MiB
- Media ID: exactly 24 base64url characters
- MIME value: 1 through 255 printable ASCII bytes and containing `/`
- Maintenance timestamp: 1 through 32 bytes
- Phase 2 raw IPC document request: document maximum plus a bounded 64 KiB envelope allowance

Missing or duplicate singleton rows, malformed SQLite storage classes, oversized fields, unsupported identifiers, and unsupported parameters are rejected before expensive derivation or large Rust allocations.

## SQLite tables

### `format_info`

Exactly one row with `id = 1`:

```text
database_id
format_version = 1
document_schema_version = 1
created_at
last_saved_at
kdf_algorithm = "argon2id"
kdf_version = 19
kdf_salt
kdf_memory_kib = 65536
kdf_iterations = 3
kdf_parallelism = 1
kdf_output_bytes = 32
encryption_algorithm = "xchacha20poly1305"
key_check_nonce
key_check_ciphertext
```

The key check encrypts a fixed versioned verifier under its own fresh nonce. Its associated data includes format version and database ID. A structurally valid key-check authentication failure maps to wrong password without exposing cryptographic detail.

### `encrypted_document`

Exactly one active row:

```text
id = 1
document_schema_version
nonce
ciphertext
save_revision
updated_at
```

Associated data authenticates format version, document schema version, database ID, and save revision. A fresh random nonce is generated for every encryption. Timestamps are deliberately unauthenticated maintenance metadata and are never trusted for security decisions.

### `document_recovery`

Up to five previously committed encrypted document generations:

```text
save_revision PRIMARY KEY
document_schema_version
nonce
ciphertext
updated_at
```

Each row contains only the authenticated encrypted document envelope and revision metadata. Rotation occurs in the same SQLite transaction that preserves the current row and installs the new row. Recovery generations protect against an invalid or corrupted current encrypted payload. They do not protect against total SQLite-file loss, corruption of the recovery table, media loss, or storage-device failure.

### `media`

```text
media_id PRIMARY KEY
mime_type
byte_length
content_hash
bytes
created_at
```

Media IDs are random and reveal no filename. Loads verify both declared length and SHA-256. Original
filenames and local paths are not persisted; relationships, placement, alt text, and other semantic
metadata remain in the encrypted document.

Phase 2 exposes no media byte-array IPC command. The database intermission now supplies separate
session-bound application transport: 256 KiB chunks or a native-owned image picker, a 50 MiB import
limit, existing format validation/normalization and opaque metadata results. Lazy loads validate stored
integrity once before chunked reads. This support remains unmounted in the visible application; see ADR 005.

## Save and recovery behavior

A routine document save:

1. validates and serializes the TypeScript document;
2. checks the raw IPC envelope size before Rust deserialization;
3. encrypts with a new nonce and authenticated metadata;
4. begins one SQLite transaction;
5. copies the current encrypted document row into `document_recovery`;
6. installs the new encrypted row using an expected-revision predicate;
7. updates the singleton format timestamp and rotates recovery to five rows;
8. commits.

Routine saves do not read, rewrite, or copy unchanged media. A transaction failure leaves the previous active row and recovery set committed. If commit returns an ambiguous error, Rust rereads the active revision; it accepts only a proven new revision and otherwise closes the session conservatively.

On unlock, a valid key check is followed by active-document authentication. If the active ciphertext fails authentication, recovery generations are tried newest first. The frontend is told which prior revision supplied the recovered plaintext, while the active revision remains the expected revision for a repairing save.

## Full backups

Full backups are explicit, not part of routine save. The development harness exposes an explicit action backed by SQLite's online backup API, a uniquely named partial file, and final same-directory rename. A full backup includes the current encrypted document, recovery generations, and plaintext media.

Internal generations are not a substitute for external backup. Full external backups remain necessary for whole-file loss or broad SQLite corruption. Scheduling daily/idle/large-change full backups is deferred; no multi-gigabyte copy runs on every autosave.

## Writer ownership and authorized paths

For an existing Windows database, Rust canonicalizes the path, opens a non-delete-share identity guard, obtains volume serial plus file ID, and locks an authority file keyed by that identity. Relative paths, case variants, symlinks/junctions, and hard links therefore converge on the same writer identity. Stable and development editions contend on the same database.

The adjacent `<database>.writer.lock` JSON is diagnostic only. Stale diagnostic text never grants or denies ownership. OS lock errors other than real contention keep their own error classification.

Creation first canonicalizes the parent and atomically reserves the destination with `create_new`. Initialization and both singleton inserts occur in one SQLite transaction. Cleanup removes the reservation only while its file identity still matches.

Renderers never authorize arbitrary paths. The backend file picker and recent-list resolver issue process-, edition-, operation-, and time-scoped one-use tokens. Create/open/full-backup commands redeem those tokens and enforce `.tmapdb` normalization in Rust.

## Pending unlock

Create and unlock first produce a pending backend session. TypeScript validates the current schema, invariants, database ID, schema version, and edition-purpose policy, then sends a confirmation token. Only confirmation promotes the key to unlocked. Pending sessions cannot read, save, back up, or access media and are closed on validation failure, bad confirmation, timeout, lock, or window close.

## Configuration and editions

Stable uses `com.merkdesigns.taskmap`; development uses `com.merkdesigns.taskmap.dev`. Their config directories, single-instance sessions, and recent-database files are separate. Recent paths remain backend-owned and are returned to the development renderer only with fresh authorization tokens. Settings replacement uses an atomic replace rather than remove-then-rename.

The Phase 2 harness, Rust command registration, command capability, and frontend chunk are development-build-only. The stable default capability contains no Phase 2 command.

## Device resources outside the database

ADR 005 adds edition-local `device-preferences-v1.json` (version, edition, revision, strict preferences)
and encrypted `view-state-{databaseId}.bin`. Preferences contain only default element colors, up to
eight recent colors, toolbar visibility, privacy-mode preference and dismissed update version. They
contain no document structure. Files are size-limited and atomically replaced by Rust.

The camera file contains a 24-byte nonce followed by authenticated ciphertext/tag, using the existing
session-derived key and XChaCha20-Poly1305. Associated data is
`taskmap-device-view-v1|{edition}|{databaseId}`. Its opaque plaintext is at most 128 KiB; TypeScript
validates `{ version: 1, canvases: Record<CanvasId, { pan, zoom, screen }> }`, with at most 256 entries.
Only settled cameras are persisted, without a document revision or history entry. Missing files mean
default views; invalid/corrupt files report errors. Decrypted camera caches are purged on session loss.

These resources do not change database/document version 1 and are not included in database full
backups or document recovery. Moving/restoring a database on another device does not restore its
camera cache or device preferences. No legacy settings fallback or migration is performed.

## No legacy support (new storage path)

The new storage modules accept only the current envelope. Legacy conversion remains in the future standalone migrator and is not added to the main-app Phase 2 path.
