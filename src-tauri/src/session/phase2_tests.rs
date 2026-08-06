use super::database_session::DatabaseSessionState;
use super::DatabaseSessionPhase;
use crate::database::connection::open_connection;
use crate::database::document_repository::{read_encrypted_document, read_format_info};
use crate::database::media_repository::{load_media, store_media};
use crate::database::schema::create_schema;
use crate::phase2_error::Phase2Failure;
use rusqlite::Connection;
use std::path::PathBuf;

pub(super) const PASSWORD: &[u8] = b"correct horse battery staple";
pub(super) const DOCUMENT: &str = r#"{"schemaVersion":1,"value":"phase-two-secret"}"#;
pub(super) const DATABASE_ID: &str = "database-12345678-1234-1234-1234-1234567890ab";

pub(super) fn create_database(
    directory: &tempfile::TempDir,
    name: &str,
) -> (DatabaseSessionState, PathBuf) {
    let path = directory.path().join(name);
    let service = DatabaseSessionState::default();
    let pending = service
        .create_database(
            path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            PASSWORD,
            "development",
        )
        .unwrap();
    service
        .confirm_unlock(&pending.confirmation_token, DATABASE_ID)
        .unwrap();
    (service, path)
}

pub(super) fn unlock(service: &DatabaseSessionState) -> String {
    let pending = service.unlock_database(PASSWORD).unwrap();
    let document = pending.serialized_document.to_string();
    service
        .confirm_unlock(&pending.confirmation_token, DATABASE_ID)
        .unwrap();
    document
}

#[test]
fn database_schema_password_and_authenticated_document_lifecycle() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "lifecycle.tmapdb");
    let connection = open_connection(&path).unwrap();
    let tables: Vec<String> = connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(tables.contains(&"format_info".to_string()));
    assert!(tables.contains(&"encrypted_document".to_string()));
    assert!(tables.contains(&"media".to_string()));
    drop(connection);

    assert_eq!(
        service.read_document().unwrap().serialized_document,
        DOCUMENT
    );
    service.close_database().unwrap();
    service.open_database(path.clone(), "development").unwrap();
    assert!(matches!(
        service.unlock_database(b"wrong password"),
        Err(Phase2Failure::WrongPassword)
    ));
    assert_eq!(unlock(&service), DOCUMENT);

    let first_save = service.save_document(DOCUMENT, 1).unwrap();
    let first_row = read_encrypted_document(&open_connection(&path).unwrap()).unwrap();
    service
        .save_document(DOCUMENT, first_save.revision)
        .unwrap();
    let second_row = read_encrypted_document(&open_connection(&path).unwrap()).unwrap();
    assert_ne!(first_row.nonce, second_row.nonce);
    assert_ne!(first_row.ciphertext, second_row.ciphertext);

    let mut modified = second_row.ciphertext;
    modified[0] ^= 1;
    open_connection(&path)
        .unwrap()
        .execute(
            "UPDATE encrypted_document SET ciphertext = ?1 WHERE id = 1",
            [&modified],
        )
        .unwrap();
    assert!(matches!(
        service.read_document(),
        Err(Phase2Failure::CorruptDatabase)
    ));
}

#[test]
fn salts_and_envelope_nonces_are_fresh_and_stored_at_exact_lengths() {
    let directory = tempfile::tempdir().unwrap();
    let (first_service, first_path) = create_database(&directory, "salt-one.tmapdb");
    let (second_service, second_path) = create_database(&directory, "salt-two.tmapdb");
    let first_connection = open_connection(&first_path).unwrap();
    let second_connection = open_connection(&second_path).unwrap();
    let first_format = read_format_info(&first_connection).unwrap();
    let second_format = read_format_info(&second_connection).unwrap();
    let first_document = read_encrypted_document(&first_connection).unwrap();

    assert_eq!(first_format.kdf_salt.len(), 16);
    assert_eq!(first_format.key_check_nonce.len(), 24);
    assert_eq!(first_document.nonce.len(), 24);
    assert_ne!(first_format.kdf_salt, second_format.kdf_salt);
    assert_ne!(first_format.key_check_nonce, first_document.nonce);
    first_service.close_database().unwrap();
    second_service.close_database().unwrap();
}

#[test]
fn explicit_lock_removes_key_access_and_quit_requires_unlock_in_new_service() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "locking.tmapdb");
    assert_eq!(
        service.get_status().unwrap().phase,
        DatabaseSessionPhase::Unlocked
    );

    assert_eq!(
        service.lock_database().unwrap().phase,
        DatabaseSessionPhase::Locked
    );
    assert!(matches!(
        service.read_document(),
        Err(Phase2Failure::SessionLocked)
    ));
    assert!(matches!(
        service.save_document(DOCUMENT, 1),
        Err(Phase2Failure::SessionLocked)
    ));
    assert_eq!(unlock(&service), DOCUMENT);
    service.quit_session().unwrap();

    let next_process = DatabaseSessionState::default();
    let status = next_process.open_database(path, "development").unwrap();
    assert_eq!(status.phase, DatabaseSessionPhase::Locked);
    assert!(matches!(
        next_process.read_document(),
        Err(Phase2Failure::SessionLocked)
    ));
}

#[test]
fn unsupported_format_version_fails_cleanly() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "unsupported.tmapdb");
    service.close_database().unwrap();
    let connection = open_connection(&path).unwrap();
    connection
        .execute_batch("PRAGMA ignore_check_constraints = ON")
        .unwrap();
    connection
        .execute(
            "UPDATE format_info SET format_version = 999 WHERE id = 1",
            [],
        )
        .unwrap();
    drop(connection);

    assert!(matches!(
        service.open_database(path, "development"),
        Err(Phase2Failure::UnsupportedFormat)
    ));
}

#[test]
fn media_is_plaintext_independent_and_has_no_filename_column() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("media.tmapdb");
    let connection = Connection::open(&path).unwrap();
    create_schema(&connection).unwrap();
    let bytes = b"visible-unencrypted-media-bytes";
    let media_id = store_media(&connection, "image/png", bytes, "1").unwrap();
    let loaded = load_media(&connection, &media_id).unwrap();
    assert_eq!(loaded.bytes, bytes);
    assert_eq!(loaded.mime_type, "image/png");
    assert_eq!(loaded.media_id, media_id);

    let columns: Vec<String> = connection
        .prepare("PRAGMA table_info(media)")
        .unwrap()
        .query_map([], |row| row.get(1))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(!columns.iter().any(|column| column.contains("filename")));
    drop(connection);

    let file_bytes = std::fs::read(&path).unwrap();
    assert!(contains_bytes(&file_bytes, bytes));
    assert!(!contains_bytes(&file_bytes, b"original-secret-name.png"));
}

#[test]
fn failed_transaction_preserves_previous_encrypted_document() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "transaction.tmapdb");
    let connection = open_connection(&path).unwrap();
    connection
        .execute_batch(
            "CREATE TRIGGER reject_format_update BEFORE UPDATE ON format_info
             BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;",
        )
        .unwrap();
    drop(connection);

    assert!(service.save_document("replacement", 1).is_err());
    assert_eq!(
        service.read_document().unwrap().serialized_document,
        DOCUMENT
    );
    assert_eq!(
        read_encrypted_document(&open_connection(&path).unwrap())
            .unwrap()
            .save_revision,
        1
    );
    let recovery_count: i64 = open_connection(&path)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM document_recovery", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(recovery_count, 0);
}

#[test]
fn explicit_full_backup_is_consistent() {
    let directory = tempfile::tempdir().unwrap();
    let (service, _path) = create_database(&directory, "backup.tmapdb");
    service.save_document("updated document", 1).unwrap();
    let first_backup = directory.path().join("explicit-backup.tmapdb");
    service.full_backup(&first_backup).unwrap();
    assert!(first_backup.is_file());
    assert!(matches!(
        service.full_backup(&first_backup),
        Err(Phase2Failure::AlreadyExists)
    ));
    assert_eq!(
        service.read_document().unwrap().serialized_document,
        "updated document"
    );
    service.close_database().unwrap();

    let restored = directory.path().join("restored.tmapdb");
    std::fs::copy(first_backup, &restored).unwrap();
    let restored_service = DatabaseSessionState::default();
    restored_service
        .open_database(restored, "development")
        .unwrap();
    assert_eq!(unlock(&restored_service), "updated document");
}

#[test]
fn pending_unlock_blocks_data_operations_and_cancellation_releases_the_writer() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("pending.tmapdb");
    let service = DatabaseSessionState::default();
    let pending = service
        .create_database(
            path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            PASSWORD,
            "development",
        )
        .unwrap();
    assert_eq!(
        service.get_status().unwrap().phase,
        DatabaseSessionPhase::PendingUnlock
    );
    assert!(matches!(
        service.read_document(),
        Err(Phase2Failure::SessionLocked)
    ));
    assert!(matches!(
        service.save_document(DOCUMENT, 1),
        Err(Phase2Failure::SessionLocked)
    ));
    assert_eq!(
        service
            .cancel_pending_unlock(&pending.confirmation_token)
            .unwrap()
            .phase,
        DatabaseSessionPhase::Closed
    );
    let next = DatabaseSessionState::default();
    assert!(next.open_database(path, "development").is_ok());
}

#[test]
fn pending_unlock_timeout_closes_session_and_releases_writer() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("pending-timeout.tmapdb");
    let service = DatabaseSessionState::default();
    let pending = service
        .create_database(
            path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            PASSWORD,
            "development",
        )
        .unwrap();
    service.force_pending_expired();
    assert!(service.expire_pending_unlock(&pending.confirmation_token));
    assert_eq!(
        service.get_status().unwrap().phase,
        DatabaseSessionPhase::Closed
    );
    assert!(DatabaseSessionState::default()
        .open_database(path, "development")
        .is_ok());
}

#[test]
fn bad_confirmation_or_pending_lock_closes_the_candidate_session() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("bad-confirmation.tmapdb");
    let service = DatabaseSessionState::default();
    let pending = service
        .create_database(
            path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            PASSWORD,
            "development",
        )
        .unwrap();
    assert!(service
        .confirm_unlock(
            &pending.confirmation_token,
            "database-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        )
        .is_err());
    assert_eq!(
        service.get_status().unwrap().phase,
        DatabaseSessionPhase::Closed
    );
    service.open_database(path, "development").unwrap();
    let pending = service.unlock_database(PASSWORD).unwrap();
    assert_eq!(
        service.lock_database().unwrap().phase,
        DatabaseSessionPhase::Closed
    );
    assert!(service
        .confirm_unlock(&pending.confirmation_token, DATABASE_ID)
        .is_err());
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}
