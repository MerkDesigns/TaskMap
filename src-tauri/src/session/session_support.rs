use crate::crypto::document_cipher::CipherFailure;
use crate::database::limits::{validate_database_id, validate_document_size, validate_password};
use crate::database::schema::CURRENT_DOCUMENT_SCHEMA_VERSION;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::{rngs::OsRng, RngCore};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) fn validate_create_input(
    database_id: &str,
    schema_version: i64,
    serialized_document: &str,
) -> Phase2Result<()> {
    validate_database_id(database_id)?;
    validate_document_size(serialized_document.len())?;
    if schema_version != CURRENT_DOCUMENT_SCHEMA_VERSION {
        return Err(Phase2Failure::InvalidDocumentPayload);
    }
    Ok(())
}

pub(super) fn validate_create_password(password: &[u8]) -> Phase2Result<()> {
    validate_password(password)
}

pub(super) fn validate_document_versions(
    format_version: i64,
    row_version: i64,
) -> Phase2Result<()> {
    if format_version != row_version || row_version != CURRENT_DOCUMENT_SCHEMA_VERSION {
        return Err(Phase2Failure::UnsupportedFormat);
    }
    Ok(())
}

pub(super) fn key_check_aad(database_id: &str) -> Vec<u8> {
    format!("taskmap|key-check|format=1|database={database_id}").into_bytes()
}

pub(super) fn document_aad(database_id: &str, schema_version: i64, revision: i64) -> Vec<u8> {
    format!(
        "taskmap|document|format=1|schema={schema_version}|database={database_id}|revision={revision}"
    )
    .into_bytes()
}

pub(super) fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

pub(super) fn random_identifier() -> String {
    let mut bytes = [0_u8; 18];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub(super) fn map_document_cipher_failure(_failure: CipherFailure) -> Phase2Failure {
    Phase2Failure::CorruptDatabase
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authenticated_data_changes_for_every_security_field() {
        let database = "database-12345678-1234-1234-1234-1234567890ab";
        let other_database = "database-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
        assert_ne!(key_check_aad(database), key_check_aad(other_database));

        let baseline = document_aad(database, 1, 7);
        assert_ne!(baseline, document_aad(other_database, 1, 7));
        assert_ne!(baseline, document_aad(database, 2, 7));
        assert_ne!(baseline, document_aad(database, 1, 8));
        assert!(baseline.starts_with(b"taskmap|document|format=1|"));
    }
}
