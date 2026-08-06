use crate::crypto::key_derivation::KdfParameters;
use crate::database::envelope_validation::{
    validate_document_rows, validate_format_info, DocumentTable, RECOVERY_GENERATION_COUNT,
};
use crate::database::limits::validate_database_id;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use rusqlite::{params, Connection};

#[derive(Debug, Clone)]
pub(crate) struct FormatInfo {
    pub(crate) database_id: String,
    pub(crate) document_schema_version: i64,
    pub(crate) kdf_salt: Vec<u8>,
    pub(crate) kdf_parameters: KdfParameters,
    pub(crate) key_check_nonce: Vec<u8>,
    pub(crate) key_check_ciphertext: Vec<u8>,
}

#[derive(Debug, Clone)]
pub(crate) struct EncryptedDocumentRow {
    pub(crate) document_schema_version: i64,
    pub(crate) nonce: Vec<u8>,
    pub(crate) ciphertext: Vec<u8>,
    pub(crate) save_revision: i64,
    pub(crate) updated_at: String,
}

pub(crate) fn read_format_info(connection: &Connection) -> Phase2Result<FormatInfo> {
    validate_format_info(connection)?;
    let row = connection
        .query_row(
            "SELECT database_id, document_schema_version, kdf_salt,
                    key_check_nonce, key_check_ciphertext
             FROM format_info WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Vec<u8>>(2)?,
                    row.get::<_, Vec<u8>>(3)?,
                    row.get::<_, Vec<u8>>(4)?,
                ))
            },
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    validate_database_id(&row.0).map_err(|_| Phase2Failure::CorruptDatabase)?;
    Ok(FormatInfo {
        database_id: row.0,
        document_schema_version: row.1,
        kdf_salt: row.2,
        kdf_parameters: KdfParameters::default(),
        key_check_nonce: row.3,
        key_check_ciphertext: row.4,
    })
}

pub(crate) fn read_encrypted_document(
    connection: &Connection,
) -> Phase2Result<EncryptedDocumentRow> {
    validate_document_rows(connection, DocumentTable::Active)?;
    connection
        .query_row(
            "SELECT document_schema_version, nonce, ciphertext, save_revision, updated_at
             FROM encrypted_document WHERE id = 1",
            [],
            map_document_row,
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)
}

pub(crate) fn read_recovery_documents(
    connection: &Connection,
) -> Phase2Result<Vec<EncryptedDocumentRow>> {
    validate_document_rows(connection, DocumentTable::Recovery)?;
    let mut statement = connection.prepare(
        "SELECT document_schema_version, nonce, ciphertext, save_revision, updated_at
         FROM document_recovery ORDER BY save_revision DESC",
    )?;
    let rows = statement
        .query_map([], map_document_row)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| Phase2Failure::CorruptDatabase)?;
    Ok(rows)
}

fn map_document_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EncryptedDocumentRow> {
    Ok(EncryptedDocumentRow {
        document_schema_version: row.get(0)?,
        nonce: row.get(1)?,
        ciphertext: row.get(2)?,
        save_revision: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub(crate) fn insert_initial_document(
    connection: &Connection,
    row: &EncryptedDocumentRow,
) -> Phase2Result<()> {
    let changed = connection.execute(
        "INSERT INTO encrypted_document (
            id, document_schema_version, nonce, ciphertext, save_revision, updated_at
         ) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
        params![
            row.document_schema_version,
            row.nonce,
            row.ciphertext,
            row.save_revision,
            row.updated_at
        ],
    )?;
    if changed != 1 {
        return Err(Phase2Failure::CorruptDatabase);
    }
    Ok(())
}

pub(crate) fn save_document_transaction(
    connection: &mut Connection,
    row: &EncryptedDocumentRow,
    expected_revision: i64,
) -> Phase2Result<()> {
    let transaction = connection.transaction()?;
    let preserved = transaction.execute(
        "INSERT OR REPLACE INTO document_recovery
         (save_revision, document_schema_version, nonce, ciphertext, updated_at)
         SELECT save_revision, document_schema_version, nonce, ciphertext, updated_at
         FROM encrypted_document WHERE id = 1 AND save_revision = ?1",
        [expected_revision],
    )?;
    if preserved != 1 {
        return Err(Phase2Failure::RevisionConflict);
    }
    let changed = transaction.execute(
        "UPDATE encrypted_document SET document_schema_version = ?1, nonce = ?2,
         ciphertext = ?3, save_revision = ?4, updated_at = ?5
         WHERE id = 1 AND save_revision = ?6",
        params![
            row.document_schema_version,
            row.nonce,
            row.ciphertext,
            row.save_revision,
            row.updated_at,
            expected_revision
        ],
    )?;
    if changed != 1 {
        return Err(Phase2Failure::RevisionConflict);
    }
    let format_changed = transaction.execute(
        "UPDATE format_info SET document_schema_version = ?1, last_saved_at = ?2 WHERE id = 1",
        params![row.document_schema_version, row.updated_at],
    )?;
    if format_changed != 1 {
        return Err(Phase2Failure::CorruptDatabase);
    }
    transaction.execute(
        "DELETE FROM document_recovery WHERE save_revision NOT IN (
             SELECT save_revision FROM document_recovery ORDER BY save_revision DESC LIMIT ?1
         )",
        [RECOVERY_GENERATION_COUNT as i64],
    )?;
    match transaction.commit() {
        Ok(()) => Ok(()),
        Err(_) => match active_revision(connection) {
            Ok(revision) if revision == row.save_revision => Ok(()),
            _ => Err(Phase2Failure::SaveFailure),
        },
    }
}

fn active_revision(connection: &Connection) -> Phase2Result<i64> {
    connection
        .query_row(
            "SELECT save_revision FROM encrypted_document WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| Phase2Failure::CorruptDatabase)
}
