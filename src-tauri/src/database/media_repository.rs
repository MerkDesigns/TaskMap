use crate::database::limits::{
    validate_media_id, validate_media_size, validate_mime_type, MAX_DEVELOPMENT_MEDIA_BYTES,
};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MediaRecord {
    pub(crate) media_id: String,
    pub(crate) mime_type: String,
    pub(crate) bytes: Vec<u8>,
}

pub(crate) fn store_media(
    connection: &Connection,
    mime_type: &str,
    bytes: &[u8],
    created_at: &str,
) -> Phase2Result<String> {
    validate_mime_type(mime_type)?;
    validate_media_size(bytes.len())?;
    let mut random_id = [0_u8; 18];
    OsRng.fill_bytes(&mut random_id);
    let media_id = URL_SAFE_NO_PAD.encode(random_id);
    let content_hash = Sha256::digest(bytes);
    connection.execute(
        "INSERT INTO media (
            media_id, mime_type, byte_length, content_hash, bytes, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            media_id,
            mime_type,
            i64::try_from(bytes.len()).map_err(|_| Phase2Failure::InvalidDocumentPayload)?,
            content_hash.as_slice(),
            bytes,
            created_at,
        ],
    )?;
    Ok(media_id)
}

pub(crate) fn load_media(connection: &Connection, media_id: &str) -> Phase2Result<MediaRecord> {
    validate_media_id(media_id)?;
    let shape = connection
        .query_row(
            "SELECT typeof(media_id), length(media_id), typeof(mime_type), length(mime_type),
                    typeof(byte_length), byte_length, typeof(content_hash), length(content_hash),
                    typeof(bytes), length(bytes)
             FROM media WHERE media_id = ?1",
            [media_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, i64>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, i64>(9)?,
                ))
            },
        )
        .optional()?
        .ok_or(Phase2Failure::FileNotFound)?;
    if shape.0 != "text"
        || shape.1 != 24
        || shape.2 != "text"
        || !(1..=255).contains(&shape.3)
        || shape.4 != "integer"
        || shape.6 != "blob"
        || shape.7 != 32
        || shape.8 != "blob"
        || shape.5 != shape.9
        || shape.9 < 0
        || shape.9 as usize > MAX_DEVELOPMENT_MEDIA_BYTES
    {
        return Err(Phase2Failure::CorruptDatabase);
    }
    let (record, stored_length, stored_hash) = connection
        .query_row(
            "SELECT media_id, mime_type, bytes, byte_length, content_hash
             FROM media WHERE media_id = ?1",
            [media_id],
            |row| {
                Ok((
                    MediaRecord {
                        media_id: row.get(0)?,
                        mime_type: row.get(1)?,
                        bytes: row.get(2)?,
                    },
                    row.get::<_, i64>(3)?,
                    row.get::<_, Vec<u8>>(4)?,
                ))
            },
        )
        .optional()?
        .ok_or(Phase2Failure::FileNotFound)?;
    validate_mime_type(&record.mime_type).map_err(|_| Phase2Failure::CorruptDatabase)?;
    let actual_hash = Sha256::digest(&record.bytes);
    if stored_length != record.bytes.len() as i64
        || stored_hash.as_slice() != actual_hash.as_slice()
    {
        return Err(Phase2Failure::CorruptDatabase);
    }
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::schema::create_schema;

    #[test]
    fn load_verifies_sha256_and_declared_length() {
        let connection = Connection::open_in_memory().unwrap();
        create_schema(&connection).unwrap();
        let media_id = store_media(&connection, "image/gif", b"plain media", "1").unwrap();
        connection
            .execute(
                "UPDATE media SET content_hash = zeroblob(32) WHERE media_id = ?1",
                [&media_id],
            )
            .unwrap();
        assert!(matches!(
            load_media(&connection, &media_id),
            Err(Phase2Failure::CorruptDatabase)
        ));

        let second = store_media(&connection, "image/png", b"second", "1").unwrap();
        connection
            .execute_batch("PRAGMA ignore_check_constraints = ON")
            .unwrap();
        connection
            .execute(
                "UPDATE media SET byte_length = 999 WHERE media_id = ?1",
                [&second],
            )
            .unwrap();
        assert!(matches!(
            load_media(&connection, &second),
            Err(Phase2Failure::CorruptDatabase)
        ));
    }
}
