# TaskMap Database Format

## Overview

A TaskMap database is one SQLite file with the `.tmapdb` extension. The TypeScript document is encrypted; media bytes are intentionally plaintext for later lazy/streaming access. Database format version and decrypted document schema version are independent.

Version 1 uses SQLite `STRICT` tables, rollback-journal `DELETE` mode, `synchronous=FULL`, and in-memory SQLite temporary storage. Document plaintext is never supplied to SQLite, so the active database, rollback journal, recovery rows, and online backups contain only authenticated ciphertext. Media remains plaintext everywhere it is copied.

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

Media IDs are random and reveal no filename. Loads verify both declared length and SHA-256. Original filenames, relationships, placement, and semantic metadata remain in the encrypted document.

Phase 2 deliberately exposes no media byte-array IPC command. The repository and integrity tests exist now; chunked/streaming frontend transport is Phase 5 work.

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

## No legacy support

The new storage modules accept only the current envelope. Legacy conversion remains in the future standalone migrator and is not added to the main-app Phase 2 path.
