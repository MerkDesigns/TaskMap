# TaskMap Security Model

## Scope

TaskMap protects document structure and content with a user password while intentionally leaving embedded media bytes unencrypted for performance. This document defines what is protected, what remains visible, and how encryption keys live during an application session.

## Protected data

The encrypted document payload includes:

- Canvas names and structure
- Card and text-block content
- Links and local paths
- Element positions, sizes, layers, and relationships
- Extension configuration
- Workflow definitions
- Media semantic metadata such as alt text; original filenames and source paths are not persisted
- Which media belongs to which element or canvas
- Document-specific settings

## Unencrypted data

The SQLite envelope exposes:

- Database format version
- Password-derivation salt and cost parameters
- Encryption algorithm identifiers
- Random media IDs
- Media MIME type, size, hash, and bytes
- Maintenance timestamps, which are unauthenticated and treated as untrusted

Anyone possessing the file can extract unencrypted images and GIFs. The database creation screen and security settings must state this clearly.

## Password lifecycle

1. The user enters the password in the unlock UI.
2. The frontend transfers it to the Rust command over the local Tauri boundary.
3. Rust rejects unsupported envelope parameters and size limits before invoking Argon2, then derives a key with the fixed version-1 parameters.
4. Rust's command-owned password string uses zeroizing ownership and is cleared when the command completes. JavaScript strings and compiler-created copies cannot be reliably zeroized.
5. The derived key begins in zeroizing Rust ownership and moves into a pending session without cloning.
6. The key decrypts and authenticates the document payload.
7. The frontend receives the decrypted document, never the derived key, and validates its current TypeScript schema, invariants, database ID, and purpose.
8. Only an explicit confirmation promotes the pending Rust session to unlocked. Rejection, timeout, window close, or failed confirmation closes the candidate session and clears its key.

The raw password must never be written to disk, logs, analytics, crash reports, Redux, browser storage, or application configuration.

## Session behavior

### Close window

Closing the visible window keeps the background TaskMap development session active. Dirty Phase 2 harness state is validated and saved before destruction; if that save fails, close is prevented. The derived key remains in process memory, so reopening the window during that session does not require the password.

Phase 2 uses a hidden, content-free session-keeper webview instead of production tray controls. Launching the same edition again activates the single-instance callback and recreates or shows the main window. If recreation cannot produce a safe document window, the backend closes the session, destroys the keeper, and exits instead of leaving an inaccessible unlocked process.

### Explicit lock

Locking performs the following sequence:

1. Flush pending document save.
2. Remove the decrypted document from frontend state.
3. Clear document-derived caches and workflow state.
4. Clear the backend derived-key buffer.
5. Revoke media access tokens or handles associated with the unlocked document.
6. Show the unlock screen.

### Automatic lock

TaskMap locks when:

- Windows locks the user session
- The configured TaskMap inactivity timeout expires
- The user selects Lock Database

The database integration now wires explicit frontend lock and native Windows session-lock delivery.
WTS notifications cover the main window and hidden session keeper; native authority is revoked before
the renderer removes plaintext. Windows lock was manually reported working on September 23.
Configurable inactivity locking remains unimplemented and is not claimed as complete.

### Quit

Quit terminates the visible window and background process, clears key material, releases database and process locks, and requires the password on the next launch.

## Key memory

- Password command values, derived output, application-controlled Argon2 work memory, pending keys, active keys, and decrypted Rust document buffers use zeroizing ownership where practical.
- Keys move between ownership states and are not cloned.
- Keep key lifetime inside the Rust session manager.
- Do not return key material through Tauri commands.
- Treat crash dumps as a residual risk of any unlocked desktop password manager-style session.

Zeroizing ownership reduces lifetime; it does not prove complete memory erasure. The Argon2 implementation and dependencies may create internal copies. Allocators, compiler transformations, immutable JavaScript strings, Tauri/serde transport buffers, operating-system swap, crash dumps, and debugger or administrator access can retain or observe secrets. TaskMap does not claim protection against a compromised unlocked process.

## Cryptography

Required baseline:

- Password derivation: Argon2id
- Authenticated encryption: a well-reviewed AEAD construction
- Random salt per database
- Fresh nonce per encrypted document save
- Header fields authenticated as associated data
- Cryptographically secure random database and media IDs

Version 1 selects Argon2id v0x13 with 65,536 KiB memory, three iterations, one lane, a 16-byte salt, and a 32-byte derived key. Document and key-check envelopes use XChaCha20-Poly1305 with independent random 24-byte nonces. Document associated data authenticates format version, document schema version, database ID, and save revision.

Algorithm and parameter changes require an ADR and database-format version consideration.

## Wrong password versus corruption

The key-check record permits a clear distinction:

- Structurally valid key check fails: incorrect password or damage to that authenticated key-check record; these cases intentionally share one non-oracular result
- Key check succeeds but document authentication fails: corrupted or tampered document
- SQLite envelope invalid: unsupported or corrupted database

Do not expose cryptographic implementation details in normal user error messages, but logs may contain non-sensitive error categories.

## File safety

- Acquire an exclusive database writer lock before unlocking.
- Use SQLite transactions for document and media changes.
- Use a transactionally consistent backup method.
- Never create plaintext document temporary files.
- Never export decrypted content implicitly.
- Do not follow untrusted paths from document content without user action.

Routine saves never copy the whole database. In the same transaction as a save, TaskMap retains five prior authenticated encrypted-document generations; unchanged media is untouched. An explicit full-backup command uses SQLite's online backup API, an identity-owned partial file, and a non-replacing final move. Internal generations help recover document payloads but do not protect against whole-file loss, broad SQLite corruption, or media loss, so external full backups remain necessary. Automatic full-backup scheduling is deferred.

## Workflow Runner security

- Workflows use structured executable and argument fields.
- No raw shell text in the first version.
- No administrator elevation.
- No hidden elevated process.
- Imported workflows start disabled and untrusted.
- Display the executable, arguments, and working directory before first trust.
- Track and stop only processes launched by TaskMap.
- Do not log environment secrets or command output marked sensitive.

## Development edition

Stable and development builds use different identities and session managers. TaskMap Dev must not automatically open the stable database.

TaskMap Dev rejects a production-purpose decrypted document after validation and closes the candidate
session; the stable application client likewise rejects development-purpose documents. Stable builds
do not register the `phase2_*` harness commands or select its capability. Both editions still contend
on the same underlying database file identity.

## Tauri boundary

Phase 2 IPC aliases remain compiled/registered only with the development Cargo feature and require
the development application identifier. The database intermission adds separate `app_*` commands in
the explicit `application-database` capability, selected by stable and development product configs
for the local `main` window only. Remote content and the hidden keeper receive no database grant;
UI Lab configuration omits the grant and its builds are also denied by the native application guard.
Only known stable/development identifiers are accepted. Native edition metadata selects the
frontend purpose policy; native confirm/save independently require the matching declared purpose.
TypeScript still owns document/schema validation; Rust does not parse the document's domain fields.

Intermission step 3c1 wires a required application-supplied retained-feature policy into the
product client and workspace. It rejects invalid feature data before create IPC or pending confirmation,
relocks invalid resumed documents, and rejects invalid saves before native invocation. Workspace
load/edit/history candidates are checked before publication. The generic core and development harness
remain feature-agnostic; the product composition explicitly supplies the policy to both boundaries.
Policy exceptions reject without exposing content/exception text. Validation retains no long-lived
projection cache. This is not a replacement for native authorization, key cleanup, action-specific
lock rules, or the still-pending live startup/session-lock acceptance.

The two command families use one implementation, not separate storage/session engines. The new
application composition is now selected by product startup. Legacy storage/keyring, portable conversion,
legacy media and Discord modules are excluded from the native module graph; raw runner execution and
legacy command grants are removed. A preview-only empty-load response has no filesystem authority.
Dev configurations do not inherit stable updater endpoints. Live activation and automatic-lock
acceptance still remain; source exclusion alone does not establish finished product security.
The shared keeper still uses the historical, content-free
`phase2-keeper.html` asset and has no command authority. Renaming it is not a security boundary.

Create, open and explicit backup redeem short-lived, one-use, process- and edition-scoped path tokens
issued by the backend picker or edition-local recent-list resolver; a renderer cannot pass a raw path.
Raw bodies are rejected above conservative limits before JSON deserialization, and request structures
reject unknown fields. Save requests include the validated session ID and database ID, checked under
the same Rust mutex as the revision check/write. The session ID changes on each successful password
unlock, so an old save cannot target a reopened or relocked/re-unlocked document at the same revision.
Application media transport now uses 256 KiB chunks and captured session/database identities, checked
under that same mutex. One staged upload is capped at 50 MiB, validates token/offset/length, expires on
the next media request after 60 seconds of inactivity and is dropped on lock/disposal. A separate native
image picker rechecks authority after selection; renderer-controlled raw paths are not accepted. Shared
image validation/normalization runs on native worker tasks. Lazy reads validate hash/length/format once
per load before bounded reads; native validation still holds bounded full-image/decode buffers.
Frontend leases cancel late results and revoke URLs on release/session transitions. Retained visible
renderers now use those leases. WTS lock notifications are wired to native session revocation before
a content-free renderer event; the retained view then synchronously unmounts its canvas and portals
without flushing document changes. Production activation and actual Windows lock acceptance remain
pending, so these paths are not yet a completed production guarantee.

ADR 005 also defines strict edition-local device preferences and an encrypted per-database camera cache.
Only the small non-document preference allowlist is plaintext. Canvas identities/coordinates are
encrypted with the existing unlocked key and fresh nonce, using a separate authenticated-data domain.
No key is cloned into a preference service; Rust responses reuse zeroizing/redacted ownership. View-cache
reads/writes require the current unlocked identity, and application purge rejects late responses. The
device-local cache is outside database backups; missing caches use defaults and corrupt caches fail
explicitly. No legacy keyring or settings fallback is added. These unmounted services do not yet prove
that visible drafts, clipboard buffers, image elements and native window lifecycle are cleaned up.

## Storage-free development baseline

The separate `app:preview:mcp` launch is for disposable UI inspection only. A dedicated application
identifier and Cargo feature must agree before plugin/single-instance setup; release compilation with
the feature is rejected. Startup and close skip database/image-GC/window-state work. Native legacy
session/path/keyring entry points reject access, and media/portable commands reject before file dialogs
or file reads. Its minimal local-main capability grants only the built-in default load and window/event
operations, not saves, reset, import/export, commands, updater or either database family. Application
database guards also reject its identifier. No credential is read, copied, renamed or deleted to isolate it.

The preview displays a permanent no-save notice. Frontend autosave/RPC/automatic update suppression is
additional hygiene, not the security boundary. Normal builds do not gain this preview capability/mode
and still need the planned atomic legacy disconnection. Do not use normal dev/stable launches as safe
baseline substitutes before that cutover. Neither a preview nor a SQLite-only copy is a backup of the
old encrypted installation; no backup or recovery guarantee is claimed by these changes.

## Logging

Logs may include:

- Error category
- Database operation name
- Random operation/session ID
- Timing and byte counts
- Non-sensitive schema and format versions

Logs must not include:

- Passwords or derived keys
- Decrypted document JSON
- Card text, links, canvas names, or filenames
- Encryption nonces paired with plaintext
- Full workflow command output by default

## Security acceptance tests

At minimum test:

- Incorrect password
- Corrupt key check
- Corrupt encrypted document
- Modified authenticated header
- Lock while save is pending
- Window close without lock
- Full quit
- Concurrent database opening
- Stable/dev database collision
- Imported untrusted workflow
- Backup restoration
- Absence of plaintext document fragments in database and temporary files

Windows session-lock delivery now has a Batch B WTS hook for main/recreated/keeper windows;
the storage-free preview deliberately does not register it. Real OS-lock acceptance remains pending.
Inactivity locking remains deferred from the development-only Phase 2 slice. Native screenshot privacy
is applied before admission and before persisting a changed preference; failure revokes the view.
Actual screenshot/screen-sharing exclusion requires separate Windows acceptance, not just a successful
native API response or the preview toggle state.
