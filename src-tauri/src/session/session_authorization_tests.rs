use super::phase2_tests::{create_database, unlock, DATABASE_ID, DOCUMENT};
use crate::phase2_error::Phase2Failure;

#[test]
fn save_checks_database_and_session_identity_with_the_write_lock() {
    let directory = tempfile::tempdir().unwrap();
    let (service, _) = create_database(&directory, "identity.tmapdb");
    let status = service.get_status().unwrap();
    let session_id = status.session_id.unwrap();
    for (database, session) in [
        ("different-database", session_id.as_str()),
        (DATABASE_ID, "old-session"),
    ] {
        assert!(matches!(
            service.save_document_for_session(DOCUMENT, 1, database, session),
            Err(Phase2Failure::SessionNotOpen)
        ));
        assert_eq!(service.get_status().unwrap().revision, Some(1));
    }
    assert_eq!(
        service
            .save_document_for_session(DOCUMENT, 1, DATABASE_ID, &session_id)
            .unwrap()
            .revision,
        2
    );
}

#[test]
fn old_save_cannot_write_a_reopened_database_even_at_the_same_revision() {
    let directory = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&directory, "reopen.tmapdb");
    let old_session = service.get_status().unwrap().session_id.unwrap();
    service.close_database().unwrap();
    service.open_database(path, "development").unwrap();
    unlock(&service);
    assert!(matches!(
        service.save_document_for_session(DOCUMENT, 1, DATABASE_ID, &old_session),
        Err(Phase2Failure::SessionNotOpen)
    ));
    assert_eq!(service.read_document().unwrap().revision, 1);
}

#[test]
fn lock_and_unlock_revoke_the_previous_save_identity() {
    let directory = tempfile::tempdir().unwrap();
    let (service, _) = create_database(&directory, "reunlock.tmapdb");
    let old_session = service.get_status().unwrap().session_id.unwrap();
    service.lock_database().unwrap();
    unlock(&service);
    assert!(matches!(
        service.save_document_for_session(DOCUMENT, 1, DATABASE_ID, &old_session),
        Err(Phase2Failure::SessionNotOpen)
    ));
    let current = service.get_status().unwrap().session_id.unwrap();
    assert_eq!(
        service
            .save_document_for_session(DOCUMENT, 1, DATABASE_ID, &current)
            .unwrap()
            .revision,
        2
    );
}
