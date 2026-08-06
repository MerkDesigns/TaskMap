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
- Original media filenames and semantic metadata
- Which media belongs to which element or canvas
- Document-specific settings

## Unencrypted data

The SQLite envelope exposes:

- Database format version
- Password-derivation salt and cost parameters
- Encryption algorithm identifiers
- Random media IDs
- Media MIME type, size, hash, and bytes
- Non-sensitive maintenance timestamps

Anyone possessing the file can extract unencrypted images and GIFs. The database creation screen and security settings must state this clearly.

## Password lifecycle

1. The user enters the password in the unlock UI.
2. The frontend transfers it to the Rust command over the local Tauri boundary.
3. Rust derives a key with Argon2id using database-specific parameters.
4. The raw password buffer is cleared as soon as derivation completes.
5. Only the derived key remains in the session manager.
6. The key decrypts and authenticates the document payload.
7. The frontend receives the decrypted document, never the derived key.

The raw password must never be written to disk, logs, analytics, crash reports, Redux, browser storage, or application configuration.

## Session behavior

### Close window

Closing the visible window keeps the background TaskMap tray/session process active. The derived key remains in protected process memory, so reopening the window during that session does not require the password.

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

### Quit

Quit terminates the visible window and background process, clears key material, releases database and process locks, and requires the password on the next launch.

## Key memory

- Use a memory container that zeroizes on drop.
- Avoid accidental key copies.
- Keep key lifetime inside the Rust session manager.
- Do not return key material through Tauri commands.
- Treat crash dumps as a residual risk of any unlocked desktop password manager-style session.

The implementation must document platform limitations honestly; it must not claim that ordinary process memory is immune to an administrator, debugger, malware, or a full memory dump.

## Cryptography

Required baseline:

- Password derivation: Argon2id
- Authenticated encryption: a well-reviewed AEAD construction
- Random salt per database
- Fresh nonce per encrypted document save
- Header fields authenticated as associated data
- Cryptographically secure random database and media IDs

Algorithm and parameter changes require an ADR and database-format version consideration.

## Wrong password versus corruption

The key-check record permits a clear distinction:

- Key check fails: incorrect password
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

Opening a production-marked database from TaskMap Dev requires a warning and must not bypass the database writer lock.

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
- Windows lock event
- Inactivity lock
- Window close without lock
- Full quit
- Concurrent database opening
- Stable/dev database collision
- Imported untrusted workflow
- Backup restoration
- Absence of plaintext document fragments in database and temporary files
