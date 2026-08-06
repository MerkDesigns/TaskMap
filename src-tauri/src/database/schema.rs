use crate::crypto::document_cipher::ENCRYPTION_ALGORITHM;
use crate::crypto::key_derivation::KDF_ALGORITHM;
use crate::phase2_error::Phase2Result;
use rusqlite::{params, Connection};

pub(crate) const DATABASE_FORMAT_VERSION: i64 = 1;
pub(crate) const CURRENT_DOCUMENT_SCHEMA_VERSION: i64 = 1;

pub(crate) const CREATE_SCHEMA_SQL: &str = r#"
CREATE TABLE format_info (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    database_id             TEXT NOT NULL UNIQUE,
    format_version          INTEGER NOT NULL,
    document_schema_version INTEGER NOT NULL,
    created_at              TEXT NOT NULL,
    last_saved_at           TEXT NOT NULL,
    kdf_algorithm           TEXT NOT NULL,
    kdf_version             INTEGER NOT NULL,
    kdf_salt                BLOB NOT NULL,
    kdf_memory_kib          INTEGER NOT NULL,
    kdf_iterations          INTEGER NOT NULL,
    kdf_parallelism         INTEGER NOT NULL,
    kdf_output_bytes        INTEGER NOT NULL,
    encryption_algorithm    TEXT NOT NULL,
    key_check_nonce         BLOB NOT NULL,
    key_check_ciphertext    BLOB NOT NULL,
    CHECK (length(database_id) = 45),
    CHECK (format_version = 1),
    CHECK (document_schema_version = 1),
    CHECK (length(created_at) BETWEEN 1 AND 32),
    CHECK (length(last_saved_at) BETWEEN 1 AND 32),
    CHECK (kdf_algorithm = 'argon2id'),
    CHECK (kdf_version = 19),
    CHECK (length(kdf_salt) = 16),
    CHECK (kdf_memory_kib = 65536),
    CHECK (kdf_iterations = 3),
    CHECK (kdf_parallelism = 1),
    CHECK (kdf_output_bytes = 32),
    CHECK (encryption_algorithm = 'xchacha20poly1305'),
    CHECK (length(key_check_nonce) = 24),
    CHECK (length(key_check_ciphertext) = 36)
) STRICT;

CREATE TABLE encrypted_document (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    document_schema_version INTEGER NOT NULL,
    nonce                   BLOB NOT NULL,
    ciphertext              BLOB NOT NULL,
    save_revision           INTEGER NOT NULL CHECK (save_revision >= 1),
    updated_at              TEXT NOT NULL,
    CHECK (document_schema_version = 1),
    CHECK (length(nonce) = 24),
    CHECK (length(ciphertext) BETWEEN 16 AND 67108880),
    CHECK (length(updated_at) BETWEEN 1 AND 32)
) STRICT;

CREATE TABLE document_recovery (
    save_revision           INTEGER PRIMARY KEY CHECK (save_revision >= 1),
    document_schema_version INTEGER NOT NULL,
    nonce                   BLOB NOT NULL,
    ciphertext              BLOB NOT NULL,
    updated_at              TEXT NOT NULL,
    CHECK (document_schema_version = 1),
    CHECK (length(nonce) = 24),
    CHECK (length(ciphertext) BETWEEN 16 AND 67108880),
    CHECK (length(updated_at) BETWEEN 1 AND 32)
) STRICT;

CREATE TABLE media (
    media_id    TEXT PRIMARY KEY,
    mime_type   TEXT NOT NULL,
    byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
    content_hash BLOB NOT NULL,
    bytes       BLOB NOT NULL,
    created_at  TEXT NOT NULL,
    CHECK (length(media_id) = 24),
    CHECK (length(mime_type) BETWEEN 1 AND 255),
    CHECK (length(content_hash) = 32),
    CHECK (length(bytes) <= 67108864),
    CHECK (byte_length = length(bytes)),
    CHECK (length(created_at) BETWEEN 1 AND 32)
) STRICT;
"#;

#[derive(Debug, Clone)]
pub(crate) struct NewFormatInfo<'a> {
    pub(crate) database_id: &'a str,
    pub(crate) document_schema_version: i64,
    pub(crate) created_at: &'a str,
    pub(crate) kdf_salt: &'a [u8],
    pub(crate) kdf_version: u32,
    pub(crate) kdf_memory_kib: u32,
    pub(crate) kdf_iterations: u32,
    pub(crate) kdf_parallelism: u32,
    pub(crate) kdf_output_bytes: usize,
    pub(crate) key_check_nonce: &'a [u8],
    pub(crate) key_check_ciphertext: &'a [u8],
}

pub(crate) fn create_schema(connection: &Connection) -> Phase2Result<()> {
    connection.execute_batch(CREATE_SCHEMA_SQL)?;
    Ok(())
}

pub(crate) fn insert_format_info(
    connection: &Connection,
    info: &NewFormatInfo<'_>,
) -> Phase2Result<()> {
    let changed = connection.execute(
        "INSERT INTO format_info (
            id, database_id, format_version, document_schema_version,
            created_at, last_saved_at, kdf_algorithm, kdf_version, kdf_salt,
            kdf_memory_kib, kdf_iterations, kdf_parallelism, kdf_output_bytes,
            encryption_algorithm, key_check_nonce, key_check_ciphertext
         ) VALUES (1, ?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            info.database_id,
            DATABASE_FORMAT_VERSION,
            info.document_schema_version,
            info.created_at,
            KDF_ALGORITHM,
            info.kdf_version,
            info.kdf_salt,
            info.kdf_memory_kib,
            info.kdf_iterations,
            info.kdf_parallelism,
            info.kdf_output_bytes,
            ENCRYPTION_ALGORITHM,
            info.key_check_nonce,
            info.key_check_ciphertext,
        ],
    )?;
    if changed != 1 {
        return Err(crate::phase2_error::Phase2Failure::CorruptDatabase);
    }
    Ok(())
}
