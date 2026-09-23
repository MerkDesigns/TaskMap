use super::phase2_tests::{create_database, unlock, DATABASE_ID};
use super::session_media_transfer::{MediaAction, MediaReply, CHUNK_BYTES};
use base64::{engine::general_purpose::STANDARD, Engine};

#[test]
fn validated_chunks_survive_external_mutation_and_tokens_are_bounded_and_revoked() {
    let root = tempfile::tempdir().unwrap();
    let (service, path) = create_database(&root, "read-race.tmapdb");
    let session_id = service.get_status().unwrap().session_id.unwrap();
    // Multiple chunks with valid SVG syntax, without a large decoded raster allocation.
    let bytes = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><!--{}--></svg>",
        "x".repeat(CHUNK_BYTES + 10)
    );
    let image = root.path().join("fixture.svg");
    std::fs::write(&image, &bytes).unwrap();
    let MediaReply::Stored { id, .. } = service
        .import_media_file(DATABASE_ID, &session_id, &image)
        .unwrap()
    else {
        panic!()
    };
    let run = |action| service.media_transfer(DATABASE_ID, &session_id, action);
    let describe = || {
        let MediaReply::Description { token, .. } = run(MediaAction::Describe {
            media_id: id.clone(),
        })
        .unwrap() else {
            panic!()
        };
        token
    };
    let first = describe();
    let second = describe();
    assert!(run(MediaAction::Describe {
        media_id: id.clone()
    })
    .is_err());
    assert!(run(MediaAction::Read {
        token: "unissued".into(),
        offset: 0
    })
    .is_err());
    assert!(run(MediaAction::Read {
        token: first.clone(),
        offset: usize::MAX
    })
    .is_err());
    let connection = crate::database::connection::open_connection(&path).unwrap();
    connection
        .execute(
            "UPDATE media SET bytes = zeroblob(byte_length) WHERE media_id = ?1",
            [&id],
        )
        .unwrap();
    let mut restored = Vec::new();
    for offset in (0..bytes.len()).step_by(CHUNK_BYTES) {
        let MediaReply::Chunk { data } = run(MediaAction::Read {
            token: first.clone(),
            offset,
        })
        .unwrap() else {
            panic!()
        };
        restored.extend(STANDARD.decode(data).unwrap());
    }
    assert_eq!(restored, bytes.as_bytes());
    assert!(run(MediaAction::Read {
        token: first,
        offset: 0
    })
    .is_err());
    // A new describe detects changed bytes; it cannot bless the corrupt live row.
    assert!(run(MediaAction::Describe { media_id: id }).is_err());
    service.lock_for_os_session().unwrap();
    unlock(&service);
    let new_session = service.get_status().unwrap().session_id.unwrap();
    assert!(service
        .media_transfer(
            DATABASE_ID,
            &new_session,
            MediaAction::Read {
                token: second,
                offset: 0
            }
        )
        .is_err());
}
