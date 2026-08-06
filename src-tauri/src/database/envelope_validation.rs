use crate::crypto::document_cipher::{ENCRYPTION_ALGORITHM, NONCE_BYTES};
use crate::crypto::key_derivation::{
    ARGON2_ITERATIONS, ARGON2_MEMORY_KIB, ARGON2_PARALLELISM, ARGON2_VERSION, KDF_ALGORITHM,
    KDF_SALT_BYTES,
};
use crate::crypto::secret_key::DOCUMENT_KEY_BYTES;
use crate::database::limits::{
    DATABASE_ID_BYTES, KEY_CHECK_CIPHERTEXT_BYTES, MAX_CIPHERTEXT_BYTES, MAX_TIMESTAMP_BYTES,
};
use crate::database::schema::DATABASE_FORMAT_VERSION;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use rusqlite::{params, Connection};

pub(crate) const RECOVERY_GENERATION_COUNT: usize = 5;

#[derive(Clone, Copy)]
pub(crate) enum DocumentTable {
    Active,
    Recovery,
}

impl DocumentTable {
    fn name(self) -> &'static str {
        match self {
            Self::Active => "encrypted_document",
            Self::Recovery => "document_recovery",
        }
    }
}

pub(crate) fn validate_format_info(connection: &Connection) -> Phase2Result<()> {
    ensure_singleton(connection, "format_info")?;
    let invalid: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM format_info WHERE id = 1 AND (
                typeof(database_id) <> 'text' OR length(database_id) <> ?1 OR
                typeof(format_version) <> 'integer' OR
                typeof(document_schema_version) <> 'integer' OR
                typeof(created_at) <> 'text' OR length(created_at) NOT BETWEEN 1 AND ?2 OR
                typeof(last_saved_at) <> 'text' OR length(last_saved_at) NOT BETWEEN 1 AND ?2 OR
                typeof(kdf_algorithm) <> 'text' OR length(kdf_algorithm) NOT BETWEEN 1 AND 32 OR
                typeof(kdf_version) <> 'integer' OR
                typeof(kdf_salt) <> 'blob' OR length(kdf_salt) <> ?3 OR
                typeof(kdf_memory_kib) <> 'integer' OR
                typeof(kdf_iterations) <> 'integer' OR
                typeof(kdf_parallelism) <> 'integer' OR
                typeof(kdf_output_bytes) <> 'integer' OR
                typeof(encryption_algorithm) <> 'text' OR
                    length(encryption_algorithm) NOT BETWEEN 1 AND 64 OR
                typeof(key_check_nonce) <> 'blob' OR length(key_check_nonce) <> ?4 OR
                typeof(key_check_ciphertext) <> 'blob' OR
                    length(key_check_ciphertext) <> ?5
            )",
            params![
                DATABASE_ID_BYTES as i64,
                MAX_TIMESTAMP_BYTES as i64,
                KDF_SALT_BYTES as i64,
                NONCE_BYTES as i64,
                KEY_CHECK_CIPHERTEXT_BYTES as i64,
            ],
            |row| row.get(0),
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    if invalid != 0 {
        return Err(Phase2Failure::CorruptDatabase);
    }
    let supported: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM format_info WHERE id = 1 AND
                format_version = ?1 AND kdf_algorithm = ?2 AND kdf_version = ?3 AND
                kdf_memory_kib = ?4 AND kdf_iterations = ?5 AND kdf_parallelism = ?6 AND
                kdf_output_bytes = ?7 AND encryption_algorithm = ?8",
            params![
                DATABASE_FORMAT_VERSION,
                KDF_ALGORITHM,
                ARGON2_VERSION as i64,
                ARGON2_MEMORY_KIB as i64,
                ARGON2_ITERATIONS as i64,
                ARGON2_PARALLELISM as i64,
                DOCUMENT_KEY_BYTES as i64,
                ENCRYPTION_ALGORITHM,
            ],
            |row| row.get(0),
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    if supported != 1 {
        return Err(Phase2Failure::UnsupportedFormat);
    }
    Ok(())
}

pub(crate) fn validate_document_rows(
    connection: &Connection,
    table: DocumentTable,
) -> Phase2Result<usize> {
    let table_name = table.name();
    if matches!(table, DocumentTable::Active) {
        ensure_singleton(connection, table_name)?;
    }
    let count: i64 = connection
        .query_row(&format!("SELECT COUNT(*) FROM {table_name}"), [], |row| {
            row.get(0)
        })
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    if count < 0
        || matches!(table, DocumentTable::Recovery) && count as usize > RECOVERY_GENERATION_COUNT
    {
        return Err(Phase2Failure::CorruptDatabase);
    }
    let invalid: i64 = connection
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM {table_name} WHERE
                    typeof(document_schema_version) <> 'integer' OR
                    typeof(nonce) <> 'blob' OR length(nonce) <> ?1 OR
                    typeof(ciphertext) <> 'blob' OR length(ciphertext) NOT BETWEEN 16 AND ?2 OR
                    typeof(save_revision) <> 'integer' OR save_revision < 1 OR
                    typeof(updated_at) <> 'text' OR length(updated_at) NOT BETWEEN 1 AND ?3"
            ),
            params![
                NONCE_BYTES as i64,
                MAX_CIPHERTEXT_BYTES as i64,
                MAX_TIMESTAMP_BYTES as i64
            ],
            |row| row.get(0),
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    if invalid != 0 {
        return Err(Phase2Failure::CorruptDatabase);
    }
    Ok(count as usize)
}

fn ensure_singleton(connection: &Connection, table: &str) -> Phase2Result<()> {
    let (total, singleton): (i64, i64) = connection
        .query_row(
            &format!(
                "SELECT COUNT(*), COALESCE(SUM(CASE WHEN id = 1 THEN 1 ELSE 0 END), 0)
                 FROM {table}"
            ),
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    if total != 1 || singleton != 1 {
        return Err(Phase2Failure::CorruptDatabase);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn format_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE format_info (
                    id, database_id, format_version, document_schema_version, created_at,
                    last_saved_at, kdf_algorithm, kdf_version, kdf_salt, kdf_memory_kib,
                    kdf_iterations, kdf_parallelism, kdf_output_bytes, encryption_algorithm,
                    key_check_nonce, key_check_ciphertext
                 );
                 INSERT INTO format_info VALUES (
                    1, 'database-12345678-1234-1234-1234-1234567890ab', 1, 1, '1', '1',
                    'argon2id', 19, zeroblob(16), 65536, 3, 1, 32,
                    'xchacha20poly1305', zeroblob(24), zeroblob(36)
                 );",
            )
            .unwrap();
        connection
    }

    #[test]
    fn malicious_kdf_values_and_algorithms_are_rejected_without_derivation() {
        for statement in [
            "UPDATE format_info SET kdf_memory_kib = 9223372036854775807",
            "UPDATE format_info SET kdf_iterations = 9223372036854775807",
            "UPDATE format_info SET kdf_parallelism = 9223372036854775807",
            "UPDATE format_info SET kdf_version = 16",
            "UPDATE format_info SET kdf_output_bytes = 64",
            "UPDATE format_info SET kdf_algorithm = 'scrypt'",
            "UPDATE format_info SET encryption_algorithm = 'aes-gcm'",
        ] {
            let connection = format_connection();
            connection.execute(statement, []).unwrap();
            assert!(matches!(
                validate_format_info(&connection),
                Err(Phase2Failure::UnsupportedFormat)
            ));
        }
    }

    #[test]
    fn malformed_types_lengths_missing_and_duplicate_rows_are_corrupt() {
        for statement in [
            "UPDATE format_info SET kdf_memory_kib = '65536'",
            "UPDATE format_info SET kdf_salt = zeroblob(15)",
            "UPDATE format_info SET key_check_nonce = zeroblob(23)",
            "UPDATE format_info SET key_check_ciphertext = zeroblob(35)",
            "UPDATE format_info SET database_id = 'short'",
            "UPDATE format_info SET kdf_algorithm = printf('%.*c', 1000000, 'x')",
            "DELETE FROM format_info",
            "INSERT INTO format_info SELECT 2, database_id, format_version,
                document_schema_version, created_at, last_saved_at, kdf_algorithm, kdf_version,
                kdf_salt, kdf_memory_kib, kdf_iterations, kdf_parallelism, kdf_output_bytes,
                encryption_algorithm, key_check_nonce, key_check_ciphertext FROM format_info",
        ] {
            let connection = format_connection();
            connection.execute(statement, []).unwrap();
            assert!(matches!(
                validate_format_info(&connection),
                Err(Phase2Failure::CorruptDatabase)
            ));
        }
    }

    fn document_connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE encrypted_document (
                    id, document_schema_version, nonce, ciphertext, save_revision, updated_at
                 );
                 CREATE TABLE document_recovery (
                    save_revision, document_schema_version, nonce, ciphertext, updated_at
                 );
                 INSERT INTO encrypted_document VALUES (1, 1, zeroblob(24), zeroblob(16), 1, '1');",
            )
            .unwrap();
        connection
    }

    #[test]
    fn document_preflight_rejects_oversize_wrong_types_missing_and_duplicates() {
        let cases = [
            "UPDATE encrypted_document SET ciphertext = zeroblob(67108881)",
            "UPDATE encrypted_document SET nonce = 'not-a-blob'",
            "UPDATE encrypted_document SET save_revision = '1'",
            "DELETE FROM encrypted_document",
            "INSERT INTO encrypted_document VALUES (2, 1, zeroblob(24), zeroblob(16), 2, '1')",
        ];
        for statement in cases {
            let connection = document_connection();
            connection.execute(statement, []).unwrap();
            assert!(matches!(
                validate_document_rows(&connection, DocumentTable::Active),
                Err(Phase2Failure::CorruptDatabase)
            ));
        }
    }
}
