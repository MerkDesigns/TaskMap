use super::phase2_tests::{create_database, unlock, DATABASE_ID};
use super::session_media_transfer::{MediaAction, MediaReply, CHUNK_BYTES};
use crate::phase2_error::Phase2Failure;
use crate::settings::device_preferences;
use base64::{engine::general_purpose::STANDARD, Engine};

#[test]
fn native_drop_import_is_one_use_and_pending_paths_are_purged_on_lock() {
    let root = tempfile::tempdir().unwrap();
    let (service, _) = create_database(&root, "drop.tmapdb");
    let id = service.get_status().unwrap().session_id.unwrap();
    let path = root.path().join("test-only.svg");
    std::fs::write(&path, b"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"20\"><rect width=\"10\" height=\"20\" fill=\"red\"/></svg>").unwrap();
    let token = service
        .capture_image_drop(std::slice::from_ref(&path))
        .unwrap()
        .remove(0);
    assert!(service
        .import_dropped_image(DATABASE_ID, &id, &token)
        .is_ok());
    assert!(service
        .import_dropped_image(DATABASE_ID, &id, &token)
        .is_err());
    let token = service
        .capture_image_drop(std::slice::from_ref(&path))
        .unwrap()
        .remove(0);
    service.lock_for_os_session().unwrap();
    assert!(service
        .capture_image_drop(std::slice::from_ref(&path))
        .is_err());
    // Check the pending path was erased, not merely protected by a rotated session ID.
    assert!(service
        .guard()
        .unwrap()
        .as_mut()
        .unwrap()
        .image_drops
        .take(&token, DATABASE_ID, &id)
        .is_none());
    assert!(service
        .import_dropped_image(DATABASE_ID, &id, &token)
        .is_err());
}

#[test]
fn selected_file_import_uses_the_same_recipe_and_rechecks_authority() {
    let root = tempfile::tempdir().unwrap();
    let (service, _) = create_database(&root, "picker.tmapdb");
    let id = service.get_status().unwrap().session_id.unwrap();
    let path = root.path().join("test-only.svg");
    std::fs::write(&path, b"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"20\"><rect width=\"10\" height=\"20\" fill=\"red\"/></svg>").unwrap();
    let result = service.import_media_file(DATABASE_ID, &id, &path).unwrap();
    assert!(matches!(
        result,
        MediaReply::Stored {
            pixel_width: 10,
            pixel_height: 20,
            ..
        }
    ));
    service.lock_database().unwrap();
    assert!(service.import_media_file(DATABASE_ID, &id, &path).is_err());
    let pending = service
        .unlock_database(super::phase2_tests::PASSWORD)
        .unwrap();
    assert!(service
        .media_transfer(
            DATABASE_ID,
            &pending.session.session_id.unwrap(),
            MediaAction::Start { byte_length: 1 }
        )
        .is_err());
}

#[test]
fn device_preferences_are_strict_revisioned_and_edition_isolated() {
    let root = tempfile::tempdir().unwrap();
    let stable = root.path().join("stable");
    let dev = root.path().join("dev");
    let initial = device_preferences::load(&stable, "stable").unwrap();
    let mut prefs = initial.preferences;
    prefs.toolbar_buttons_visible = false;
    let saved = device_preferences::save(&stable, "stable", 0, prefs.clone()).unwrap();
    assert_eq!(saved.revision, 1);
    assert!(
        device_preferences::load(&dev, "development")
            .unwrap()
            .preferences
            .toolbar_buttons_visible
    );
    assert!(device_preferences::load(&stable, "development").is_err());
    assert!(matches!(
        device_preferences::save(&stable, "stable", 0, prefs.clone()),
        Err(Phase2Failure::RevisionConflict)
    ));
    assert_eq!(
        device_preferences::save(&stable, "stable", 1, prefs.clone())
            .unwrap()
            .revision,
        1
    );
    prefs.recent_colors = vec!["bad".into()];
    assert!(device_preferences::save(&stable, "stable", 1, prefs).is_err());
    assert!(
        serde_json::from_str::<device_preferences::DevicePreferences>(r#"{"camera":1}"#).is_err()
    );
    assert_eq!(std::fs::read_dir(&stable).unwrap().count(), 1);
}

#[test]
fn camera_cache_is_encrypted_session_bound_and_independent_of_document_revision() {
    let root = tempfile::tempdir().unwrap();
    let (service, _) = create_database(&root, "views.tmapdb");
    let id = service.get_status().unwrap().session_id.unwrap();
    let prefs = root.path().join("prefs");
    let value = r#"{"canvas-secret":{"pan":{"x":42,"y":13}}}"#;
    assert!(service
        .view_state(&prefs, "development", DATABASE_ID, &id, None)
        .unwrap()
        .is_none());
    service
        .view_state(&prefs, "development", DATABASE_ID, &id, Some(value))
        .unwrap();
    let path = prefs.join(format!("view-state-{DATABASE_ID}.bin"));
    let bytes = std::fs::read(&path).unwrap();
    assert!(!String::from_utf8_lossy(&bytes).contains("canvas-secret"));
    assert_eq!(
        service
            .view_state(&prefs, "development", DATABASE_ID, &id, None)
            .unwrap()
            .unwrap(),
        value
    );
    assert!(service
        .view_state(&prefs, "stable", DATABASE_ID, &id, None)
        .is_err());
    service
        .view_state(&prefs, "development", DATABASE_ID, &id, Some(value))
        .unwrap();
    assert_ne!(bytes, std::fs::read(&path).unwrap());
    assert_eq!(service.get_status().unwrap().revision, Some(1));
    service.lock_database().unwrap();
    assert!(service
        .view_state(&prefs, "development", DATABASE_ID, &id, None)
        .is_err());
    unlock(&service);
    assert!(service
        .view_state(&prefs, "development", DATABASE_ID, &id, Some("old"))
        .is_err());
    let new_id = service.get_status().unwrap().session_id.unwrap();
    assert_eq!(
        service
            .view_state(&prefs, "development", DATABASE_ID, &new_id, None)
            .unwrap()
            .unwrap(),
        value
    );
    let mut corrupt = std::fs::read(&path).unwrap();
    *corrupt.last_mut().unwrap() ^= 1;
    std::fs::write(&path, corrupt).unwrap();
    assert!(service
        .view_state(&prefs, "development", DATABASE_ID, &new_id, None)
        .is_err());
}

#[test]
fn bounded_media_import_preserves_gif_and_revokes_uploads_on_lock() {
    let root = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&root, "media.tmapdb");
    let id = service.get_status().unwrap().session_id.unwrap();
    let gif = STANDARD
        .decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
        .unwrap();
    let run = |action| service.media_transfer(DATABASE_ID, &id, action);
    assert!(run(MediaAction::Start {
        byte_length: 50 * 1024 * 1024 + 1
    })
    .is_err());
    let MediaReply::Started { token } = run(MediaAction::Start {
        byte_length: gif.len(),
    })
    .unwrap() else {
        panic!()
    };
    assert!(run(MediaAction::Start { byte_length: 1 }).is_err());
    assert!(run(MediaAction::Append {
        token: token.clone(),
        offset: 1,
        data: STANDARD.encode(&gif)
    })
    .is_err());
    assert!(run(MediaAction::Append {
        token: token.clone(),
        offset: 0,
        data: STANDARD.encode(vec![0; CHUNK_BYTES + 1])
    })
    .is_err());
    run(MediaAction::Append {
        token: token.clone(),
        offset: 0,
        data: STANDARD.encode(&gif),
    })
    .unwrap();
    let MediaReply::Stored {
        id: media_id,
        mime_type,
        pixel_width,
        ..
    } = run(MediaAction::Finish { token }).unwrap()
    else {
        panic!()
    };
    assert_eq!(mime_type, "image/gif");
    assert_eq!(pixel_width, 1);
    let MediaReply::Description {
        token: read_token, ..
    } = run(MediaAction::Describe {
        media_id: media_id.clone(),
    })
    .unwrap()
    else {
        panic!()
    };
    let MediaReply::Chunk { data } = run(MediaAction::Read {
        token: read_token.clone(),
        offset: 0,
    })
    .unwrap() else {
        panic!()
    };
    assert_eq!(STANDARD.decode(data).unwrap(), gif);
    assert_eq!(service.get_status().unwrap().revision, Some(1));
    let MediaReply::Started { token } = run(MediaAction::Start { byte_length: 10 }).unwrap() else {
        panic!()
    };
    service.lock_database().unwrap();
    assert!(run(MediaAction::Read {
        token: read_token,
        offset: 0
    })
    .is_err());
    unlock(&service);
    assert!(run(MediaAction::Finish { token }).is_err());
    let current = service.get_status().unwrap().session_id.unwrap();
    assert!(service
        .media_transfer(
            DATABASE_ID,
            &current,
            MediaAction::Start { byte_length: 10 }
        )
        .is_ok());
    let connection = crate::database::connection::open_connection(&path).unwrap();
    assert_eq!(
        connection
            .query_row("SELECT count(*) FROM media", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn media_rejects_unsafe_svg_and_incomplete_upload_without_document_or_media_writes() {
    let root = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&root, "invalid.tmapdb");
    let id = service.get_status().unwrap().session_id.unwrap();
    for bytes in [
        b"<svg width=\"10\" height=\"10\"><script>alert(1)</script></svg>".as_slice(),
        b"not an image",
    ] {
        let MediaReply::Started { token } = service
            .media_transfer(
                DATABASE_ID,
                &id,
                MediaAction::Start {
                    byte_length: bytes.len(),
                },
            )
            .unwrap()
        else {
            panic!()
        };
        service
            .media_transfer(
                DATABASE_ID,
                &id,
                MediaAction::Append {
                    token: token.clone(),
                    offset: 0,
                    data: STANDARD.encode(bytes),
                },
            )
            .unwrap();
        assert!(service
            .media_transfer(DATABASE_ID, &id, MediaAction::Finish { token })
            .is_err());
    }
    let MediaReply::Started { token } = service
        .media_transfer(DATABASE_ID, &id, MediaAction::Start { byte_length: 5 })
        .unwrap()
    else {
        panic!()
    };
    assert!(service
        .media_transfer(DATABASE_ID, &id, MediaAction::Finish { token })
        .is_err());
    let connection = crate::database::connection::open_connection(&path).unwrap();
    assert_eq!(
        connection
            .query_row("SELECT count(*) FROM media", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        0
    );
}
