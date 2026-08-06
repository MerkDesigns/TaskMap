# ADR 002: Encrypted database and process session

- Status: Accepted
- Date: 2026-08-06

## Context

Phase 2 must prove a secure persistence lifecycle without coupling the legacy application to the replacement architecture. The database needs efficient independent media access, password-protected document structure, transactional document recovery, exclusive writers, and a development process session that can outlive the visible window. TypeScript owns the decrypted document schema under ADR 001.

## Decision

TaskMap uses one SQLite `.tmapdb` file. Version 1 is a strict, fixed envelope: Argon2id v0x13, 65,536 KiB, three iterations, one lane, a 16-byte salt, and a 32-byte output; XChaCha20-Poly1305 uses independent random 24-byte nonces. Readers reject wrong algorithms, parameters, SQLite storage classes, singleton counts, fixed-field lengths, and conservative size limits before Argon2 or large variable-field reads.

`format_info` stores envelope fields, a random canonical database ID, a key-check ciphertext, and untrusted maintenance timestamps. `encrypted_document` stores the active authenticated ciphertext and monotonic revision. Associated data authenticates format version, document schema version, database ID, and revision. The key check has separate versioned associated data. A structurally valid key-check authentication failure has one non-oracular wrong-password result; document authentication failure after a valid key check is corruption.

`document_recovery` retains the previous five authenticated document generations. The current row is preserved, a new row installed, singleton metadata updated, and generations rotated in one transaction. Routine saves do not inspect or copy media. `media` stores opaque random IDs, MIME, exact byte length, SHA-256, creation time, and intentionally plaintext bytes. Loads verify both length and hash. Filenames, relationships, placement, and meaning remain encrypted.

Full SQLite online backup is an explicit operation only. It writes an identity-owned, randomly named partial file beside the destination and publishes it with a non-replacing move. Automatic idle/daily/large-change scheduling is deferred. Internal generations do not protect against total SQLite-file loss, broad corruption, media loss, or device failure; external full backups remain required.

Unlock has two phases. Rust validates the envelope and key check, decrypts into zeroizing ownership, and retains the candidate key in a pending session. The TypeScript adapter validates schema, invariants, database ID, schema version, and edition purpose, then confirms with a random expiring token. Pending sessions cannot read, save, back up, or access media. Rejection, timeout, lock, close, failed confirmation, or window loss closes the candidate, zeroizes its key, and releases the writer lock. Rust does not retain document plaintext after the response is serialized.

Password command values, derived output, application-controlled Argon2 work memory, pending and active keys, and decrypted Rust buffers use zeroizing ownership where practical; keys move rather than clone. This reduces lifetime but cannot erase every Argon2-internal, allocator, compiler, JavaScript-string, serialization, swap, crash-dump, or debugger copy.

Sensitive paths are backend-authorized. The picker and recent-list resolver issue short-lived, one-use tokens scoped to the process, edition, operation, and one normalized `.tmapdb` path. IPC create/open/full-backup accepts tokens, never raw paths. Direct service tests retain internal path APIs.

Existing Windows databases are canonicalized and identified by volume serial plus file ID. An OS lock file keyed by that identity is authoritative across relative paths, case variants, links, and editions. The database handle denies delete sharing for the session. The adjacent writer JSON is diagnostic only and stale text has no authority. Creation canonicalizes the parent and reserves the destination with `create_new` before initialization. Schema and singleton initialization share one transaction, and failed cleanup removes a file only while its identity still matches the reservation.

Phase 2 commands, capability, and frontend harness are development-build-only. Stable identity is `com.merkdesigns.taskmap`; development is `com.merkdesigns.taskmap.dev`, producing separate configuration, recent lists, and singleton sessions. Stable builds contain no Phase 2 plaintext commands. Full-memory media IPC is omitted; streaming/chunked media transport is Phase 5.

The development keeper is content-free and may preserve an unlocked process after main-window close. Dirty harness state is saved before close. If main-window recreation fails, the backend closes the session, destroys the keeper, and exits. Explicit lock, close, quit, pending cancellation, validation failure, and recreation failure converge on the same session manager. Native Windows session-lock delivery, inactivity locking, and final tray UX remain deferred; no renderer-callable fake OS-lock command exists.

## Security-sensitive dependencies

- `argon2 0.5.3` implements the fixed Argon2id derivation and enables available zeroization support.
- `chacha20poly1305 0.10.1` provides RustCrypto XChaCha20-Poly1305.
- `rand 0.8` supplies `OsRng` for salts, nonces, IDs, and authorization tokens.
- `zeroize 1.8` supplies zero-on-drop ownership for application-controlled secret buffers.
- `rusqlite 0.32` with bundled SQLite and online-backup support provides transactional storage without SQLCipher.
- `fs2 0.4.3` provides the cross-process authority-file lock.
- Windows file APIs provide stable file identity, non-delete-share handles, and atomic settings/backup moves.
- `sha2 0.10` verifies intentionally plaintext media integrity; it is not a password primitive.

## Consequences and deferred work

- SQLite structure, envelope parameters, timestamps, MIME types, media sizes, hashes, and media bytes are visible.
- The development frontend necessarily receives decrypted JSON and cannot reliably scrub JavaScript strings or browser/Tauri transport copies.
- Internal document generations make routine saves independent of total media size but are not full backups.
- Automatic full-backup policy, streaming media transport, native Windows session-lock delivery, inactivity locking, production tray UX, config import/export UI, media cleanup, and production autosave integration remain later work.
- No legacy migration, keyring, SQLCipher, Workflow Runner, element implementation, or canvas behavior enters this slice.
