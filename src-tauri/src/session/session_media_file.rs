use super::database_session::{DatabaseSessionState, OpenSession};
use super::session_media_transfer::MediaReply;
use super::session_state_access::authorized_session;
use super::session_support::timestamp;
use crate::database::{connection::open_connection, media_repository::store_media};
use crate::image_processing::normalize_image;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::io::Read;
use std::path::Path;

pub(super) fn persist_image(session: &OpenSession, input: &[u8]) -> Phase2Result<MediaReply> {
    let (format, bytes, pixel_width, pixel_height) =
        normalize_image(input).map_err(|_| Phase2Failure::InvalidInput)?;
    let mime_type = if format == "svg" {
        "image/svg+xml".to_owned()
    } else {
        format!("image/{format}")
    };
    let connection = open_connection(&session.database_path)?;
    let id = store_media(&connection, &mime_type, &bytes, &timestamp())?;
    Ok(MediaReply::Stored {
        id,
        mime_type,
        byte_length: bytes.len(),
        pixel_width,
        pixel_height,
    })
}
impl DatabaseSessionState {
    pub(crate) fn authorize_media(&self, database_id: &str, session_id: &str) -> Phase2Result<()> {
        let mut guard = self.guard()?;
        authorized_session(&mut guard, database_id, session_id).map(|_| ())
    }
    // Path comes only from the native user picker, never renderer input or document content.
    pub(crate) fn import_media_file(
        &self,
        database_id: &str,
        session_id: &str,
        path: &Path,
    ) -> Phase2Result<MediaReply> {
        self.authorize_media(database_id, session_id)?;
        let file = std::fs::File::open(path).map_err(Phase2Failure::from_io)?;
        if !file.metadata().map_err(Phase2Failure::from_io)?.is_file() {
            return Err(Phase2Failure::InvalidInput);
        }
        let mut bytes = Vec::new();
        file.take(50 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(Phase2Failure::from_io)?;
        if bytes.len() > 50 * 1024 * 1024 {
            return Err(Phase2Failure::InvalidInput);
        }
        let mut guard = self.guard()?;
        let session = authorized_session(&mut guard, database_id, session_id)?;
        persist_image(session, &bytes)
    }
}
