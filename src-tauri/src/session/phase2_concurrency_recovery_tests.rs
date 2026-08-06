use super::database_session::DatabaseSessionState;
use super::phase2_tests::{create_database, DATABASE_ID, DOCUMENT, PASSWORD};
use super::DatabaseSessionPhase;
use crate::database::connection::open_connection;
use crate::database::document_repository::read_encrypted_document;
use crate::database::media_repository::{load_media, store_media};
use crate::phase2_error::Phase2Failure;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Barrier};

#[test]
fn concurrent_saves_are_serialized_and_one_revision_conflicts() {
    let directory = tempfile::tempdir().unwrap();
    let (service, _path) = create_database(&directory, "concurrent-save.tmapdb");
    let barrier = Arc::new(Barrier::new(3));
    let handles = ["first", "second"].map(|document| {
        let service = service.clone();
        let barrier = barrier.clone();
        std::thread::spawn(move || {
            barrier.wait();
            service.save_document(document, 1)
        })
    });
    barrier.wait();
    let results = handles.map(|handle| handle.join().unwrap());
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|result| matches!(result, Err(Phase2Failure::RevisionConflict)))
            .count(),
        1
    );
}

#[test]
fn save_racing_lock_or_close_converges_to_a_non_writable_state() {
    for close in [false, true] {
        let directory = tempfile::tempdir().unwrap();
        let (service, _path) = create_database(&directory, "save-race.tmapdb");
        let barrier = Arc::new(Barrier::new(2));
        let saver = {
            let service = service.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                service.save_document("racing document", 1)
            })
        };
        barrier.wait();
        if close {
            service.close_database().unwrap();
        } else {
            service.lock_database().unwrap();
        }
        let _ = saver.join().unwrap();
        let phase = service.get_status().unwrap().phase;
        assert_eq!(
            phase,
            if close {
                DatabaseSessionPhase::Closed
            } else {
                DatabaseSessionPhase::Locked
            }
        );
        assert!(service.save_document("after", 2).is_err());
    }
}

#[test]
fn recovery_generations_rotate_and_a_corrupt_active_payload_recovers_previous_commit() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "recovery.tmapdb");
    for revision in 1..=7 {
        service
            .save_document(&format!("document-{revision}"), revision)
            .unwrap();
    }
    let connection = open_connection(&path).unwrap();
    let revisions: Vec<i64> = connection
        .prepare("SELECT save_revision FROM document_recovery ORDER BY save_revision")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(revisions, vec![3, 4, 5, 6, 7]);
    let mut active = read_encrypted_document(&connection).unwrap().ciphertext;
    active[0] ^= 1;
    connection
        .execute(
            "UPDATE encrypted_document SET ciphertext = ?1 WHERE id = 1",
            [&active],
        )
        .unwrap();
    drop(connection);
    service.close_database().unwrap();
    service.open_database(path, "development").unwrap();
    let pending = service.unlock_database(PASSWORD).unwrap();
    assert_eq!(pending.recovered_from_revision, Some(7));
    assert_eq!(pending.serialized_document, "document-6");
}

#[test]
fn routine_save_never_copies_or_mutates_media() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "large-media.tmapdb");
    let connection = open_connection(&path).unwrap();
    let media = vec![0x5a; 8 * 1024 * 1024];
    let media_id = store_media(&connection, "image/gif", &media, "1").unwrap();
    connection
        .execute_batch(
            "CREATE TRIGGER reject_media_update BEFORE UPDATE ON media
             BEGIN SELECT RAISE(ABORT, 'media changed'); END;
             CREATE TRIGGER reject_media_delete BEFORE DELETE ON media
             BEGIN SELECT RAISE(ABORT, 'media changed'); END;",
        )
        .unwrap();
    drop(connection);
    service.save_document("small document update", 1).unwrap();
    let loaded = load_media(&open_connection(&path).unwrap(), &media_id).unwrap();
    assert_eq!(loaded.bytes, media);
    let files: Vec<_> = std::fs::read_dir(directory.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert!(!files
        .iter()
        .any(|name| name.to_string_lossy().contains("backup")));
}

#[test]
fn plaintext_document_is_absent_from_active_and_closed_artifacts() {
    use crate::settings::recent_databases::record_recent;

    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "plaintext-scan.tmapdb");
    service.save_document(DOCUMENT, 1).unwrap();
    let backup = directory.path().join("scan-backup.tmapdb");
    service.full_backup(&backup).unwrap();
    record_recent(&directory.path().join("config"), "development", &path).unwrap();

    let mut active_files = Vec::new();
    visit(directory.path(), &mut active_files);
    assert_no_plaintext(&active_files);
    service.close_database().unwrap();

    let mut closed_files = Vec::new();
    visit(directory.path(), &mut closed_files);
    assert_no_plaintext(&closed_files);
}

#[test]
fn unicode_and_password_boundaries_are_enforced() {
    use crate::database::limits::MAX_PASSWORD_BYTES;

    let directory = tempfile::tempdir().unwrap();
    let unicode_path = directory.path().join("unicode-password.tmapdb");
    let service = DatabaseSessionState::default();
    let unicode_password = "p\u{00e4}ssw\u{00f6}rd-\u{5bc6}\u{78bc}".as_bytes();
    let pending = service
        .create_database(
            unicode_path,
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            unicode_password,
            "development",
        )
        .unwrap();
    service
        .confirm_unlock(&pending.confirmation_token, DATABASE_ID)
        .unwrap();
    service.close_database().unwrap();

    let empty_path = directory.path().join("empty-password.tmapdb");
    assert!(service
        .create_database(
            empty_path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            b"",
            "development"
        )
        .is_err());
    assert!(!empty_path.exists());
    let long_path = directory.path().join("long-password.tmapdb");
    assert!(service
        .create_database(
            long_path.clone(),
            DATABASE_ID.to_string(),
            1,
            DOCUMENT,
            &vec![b'x'; MAX_PASSWORD_BYTES + 1],
            "development"
        )
        .is_err());
    assert!(!long_path.exists());
}

#[test]
fn keeper_recreation_failure_policy_closes_session_and_releases_writer() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "keeper-failure.tmapdb");
    service.handle_window_recreation_failure();
    assert_eq!(
        service.get_status().unwrap().phase,
        DatabaseSessionPhase::Closed
    );
    assert!(DatabaseSessionState::default()
        .open_database(path, "development")
        .is_ok());
}

fn visit(path: &Path, files: &mut Vec<PathBuf>) {
    if path.is_dir() {
        for entry in std::fs::read_dir(path).unwrap() {
            visit(&entry.unwrap().path(), files);
        }
    } else {
        files.push(path.to_path_buf());
    }
}

fn assert_no_plaintext(files: &[PathBuf]) {
    for file in files {
        let bytes = std::fs::read(file).unwrap();
        assert!(
            !contains_bytes(&bytes, b"phase-two-secret"),
            "plaintext leaked to {}",
            file.display()
        );
    }
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}
