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

Only explicit frontend lock is wired in Phase 2. Rust has an internal session-lock method for future native event delivery, but there is no renderer-callable substitute. Windows event delivery and inactivity timers are deferred and are not claimed as complete.

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

TaskMap Dev rejects a production-purpose decrypted document after validation and closes the candidate session. Stable builds do not contain the Phase 2 harness, Rust command registration, or Phase 2 capability. Both editions still contend on the same underlying database file identity.

## Tauri boundary

Phase 2 IPC is compiled and registered only with the development Cargo feature, and its capability is present only in the development configuration overlay. The stable default capability contains none of the sensitive commands. Create, open, and explicit-backup commands redeem short-lived, one-use, process- and edition-scoped path tokens issued by the backend picker or recent-list resolver; a renderer cannot pass a raw filesystem path. Raw request bodies are rejected above conservative limits before JSON deserialization. Phase 2 exposes no full-memory media byte-array IPC; streaming transport is Phase 5 work.

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

Windows session-lock delivery and inactivity locking remain required before their later production milestones, but are explicitly deferred from this development-only Phase 2 slice.
