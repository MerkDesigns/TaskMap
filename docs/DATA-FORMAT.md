# TaskMap Database Format

## Overview

A TaskMap database is one SQLite file with the `.tmapdb` extension. The document payload is encrypted. Media bytes are intentionally unencrypted for efficient loading and GIF playback.

The database format version and decrypted document schema version are independent.

## SQLite tables

### `format_info`

One row describing the file envelope.

```text
format_version            INTEGER
created_at                TEXT
last_written_at           TEXT
kdf_algorithm             TEXT = "argon2id"
kdf_salt                  BLOB
kdf_memory_kib            INTEGER
kdf_iterations            INTEGER
kdf_parallelism           INTEGER
encryption_algorithm      TEXT
key_check_nonce           BLOB
key_check_ciphertext      BLOB
```

`key_check_ciphertext` authenticates a fixed random verifier and allows TaskMap to distinguish an incorrect password from a malformed document payload without exposing document content.

### `encrypted_document`

One active row.

```text
id                        INTEGER PRIMARY KEY CHECK (id = 1)
document_schema_version   INTEGER
nonce                     BLOB
ciphertext                BLOB
updated_at                TEXT
```

The authenticated associated data includes at least the database format version, document schema version, and database ID.

### `media`

```text
media_id                  TEXT PRIMARY KEY
mime_type                 TEXT
byte_length               INTEGER
content_hash              BLOB
bytes                     BLOB
created_at                TEXT
```

Media IDs are cryptographically random and contain no filename or semantic description. Original filenames, element relationships, canvas placement, alt text, and other identifying metadata remain inside the encrypted document.

Optional future transport fields require an ADR before addition.

### `maintenance`

Optional non-sensitive bookkeeping such as last successful compaction or backup generation. It must not contain document names, canvas names, filenames, links, or user text.

## Encrypted document model

The exact TypeScript schema lives under `src/domain/document/`. Conceptually:

```ts
type TaskMapDocument = {
  schemaVersion: number;
  databaseId: string;
  databasePurpose: "production" | "development";
  activeCanvasId: string;
  canvases: Record<string, Canvas>;
  elements: Record<string, CanvasElement>;
  connections: Record<string, MindmapConnection>;
  mediaReferences: Record<string, MediaReference>;
  documentSettings: DocumentSettings;
};
```

`MediaReference` may include presentation metadata such as natural dimensions, display mode, or original filename because the entire document payload is encrypted.

## Save behavior

Normal document save:

1. Validate the current TypeScript document.
2. Serialize deterministically enough for repeatable tests.
3. Encrypt with a new nonce.
4. Begin a SQLite transaction.
5. Replace the `encrypted_document` row.
6. Update `format_info.last_written_at`.
7. Commit.

Normal document changes do not rewrite existing media BLOBs.

Media import:

1. Stream or read media without placing bytes in Redux.
2. Compute hash and metadata in the backend.
3. Insert media under a random ID in a SQLite transaction.
4. Return the media ID to the frontend.
5. Commit a document command that references the media ID.
6. Remove the just-created media row if document commit ultimately fails and no reference exists.

Media deletion is reference-aware and may be deferred to an explicit cleanup transaction.

## Opening behavior

1. Open SQLite read/write unless another process holds the database lock.
2. Validate `format_info` without loading media.
3. Derive the key from the supplied password.
4. Verify the key-check record.
5. Decrypt the document row.
6. Validate the current document schema.
7. Load document state.
8. Load media lazily according to viewport demand.

Opening time must not scale with total media size.

## Backups

Maintain up to five rotating encrypted database backups. Backups are complete `.tmapdb` files and therefore include unencrypted media exactly as the active database does.

Backup creation must use SQLite's safe backup mechanism or another transactionally consistent copy approach. Do not byte-copy a database while writes are active without proving consistency.

## File locking

Only one process may open a database for writing. A separate lock file or OS file lock records edition, process ID, session ID, and opening timestamp.

Read-only opening may be offered later but is not required for the first vertical slice.

## Configuration file

Application configuration is not stored in `.tmapdb`. Stable and development editions use different config directories.

Config includes:

- Recent database paths
- Window state
- Theme and UI preferences
- Inactivity-lock preference
- Update preferences
- Default database path

Config export/import uses a versioned JSON document. It must not export passwords, derived keys, decrypted database contents, or workflow trust automatically unless explicitly designed and documented.

## Development protection

The encrypted document includes `databasePurpose`. TaskMap Dev defaults to a development database. Opening a production database from a development build requires an explicit warning and safe decision.

## No legacy support

The main app accepts only the new format version and current document schema policy. It does not contain old SQLite keys, keyring access, old schema migration chains, or partial legacy import logic. The standalone migrator owns that code.
