use super::database_session::DatabaseSessionState;
use super::session_state_access::authorized_session;
use super::session_support::random_identifier;
use crate::database::{connection::open_connection, media_repository::load_media};
use crate::image_processing::{decode_raster, validate_gif_animation, validate_svg};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

pub(crate) const CHUNK_BYTES: usize = 256 * 1024;
const MAX_INPUT: usize = 50 * 1024 * 1024;
pub(super) struct MediaUpload {
    token: String,
    length: usize,
    bytes: Vec<u8>,
    touched: Instant,
}
#[derive(Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum MediaAction {
    Start {
        byte_length: usize,
    },
    Append {
        token: String,
        offset: usize,
        data: String,
    },
    Finish {
        token: String,
    },
    Cancel {
        token: String,
    },
    Describe {
        media_id: String,
    },
    Read {
        media_id: String,
        offset: usize,
    },
}
#[derive(Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum MediaReply {
    Started {
        token: String,
    },
    Done,
    Stored {
        id: String,
        mime_type: String,
        byte_length: usize,
        pixel_width: u32,
        pixel_height: u32,
    },
    Description {
        mime_type: String,
        byte_length: usize,
    },
    Chunk {
        data: String,
    },
}
impl DatabaseSessionState {
    pub(crate) fn media_transfer(
        &self,
        database_id: &str,
        session_id: &str,
        action: MediaAction,
    ) -> Phase2Result<MediaReply> {
        let mut guard = self.guard()?;
        let session = authorized_session(&mut guard, database_id, session_id)?;
        if session
            .media_upload
            .as_ref()
            .is_some_and(|upload| upload.touched.elapsed() > Duration::from_secs(60))
        {
            session.media_upload = None;
        }
        match action {
            MediaAction::Start { byte_length } => {
                if byte_length == 0 || byte_length > MAX_INPUT || session.media_upload.is_some() {
                    return Err(Phase2Failure::InvalidInput);
                }
                let token = random_identifier();
                session.media_upload = Some(MediaUpload {
                    token: token.clone(),
                    length: byte_length,
                    bytes: Vec::new(),
                    touched: Instant::now(),
                });
                Ok(MediaReply::Started { token })
            }
            MediaAction::Append {
                token,
                offset,
                data,
            } => {
                if data.len() > CHUNK_BYTES.div_ceil(3) * 4 {
                    return Err(Phase2Failure::InvalidInput);
                }
                let bytes = STANDARD
                    .decode(data)
                    .map_err(|_| Phase2Failure::InvalidInput)?;
                let upload = session
                    .media_upload
                    .as_mut()
                    .ok_or(Phase2Failure::InvalidInput)?;
                if upload.token != token
                    || offset != upload.bytes.len()
                    || bytes.is_empty()
                    || bytes.len() > CHUNK_BYTES
                    || bytes.len() > upload.length - offset
                {
                    return Err(Phase2Failure::InvalidInput);
                }
                upload.bytes.extend(bytes);
                upload.touched = Instant::now();
                Ok(MediaReply::Done)
            }
            MediaAction::Cancel { token } => {
                if session
                    .media_upload
                    .as_ref()
                    .is_some_and(|upload| upload.token == token)
                {
                    session.media_upload = None;
                }
                Ok(MediaReply::Done)
            }
            MediaAction::Finish { token } => {
                if session
                    .media_upload
                    .as_ref()
                    .is_none_or(|upload| upload.token != token)
                {
                    return Err(Phase2Failure::InvalidInput);
                }
                let upload = session
                    .media_upload
                    .take()
                    .ok_or(Phase2Failure::InvalidInput)?;
                if upload.bytes.len() != upload.length {
                    return Err(Phase2Failure::InvalidInput);
                }
                super::session_media_file::persist_image(session, &upload.bytes)
            }
            MediaAction::Describe { media_id } => {
                let connection = open_connection(&session.database_path)?;
                // Validate integrity and safe decoding once per load, never on each chunk or save.
                let record = load_media(&connection, &media_id)?;
                let valid = match record.mime_type.as_str() {
                    "image/svg+xml" => validate_svg(&record.bytes).map(|_| ()),
                    "image/gif" => validate_gif_animation(&record.bytes).map(|_| ()),
                    "image/webp" | "image/png" | "image/jpeg" | "image/bmp" => {
                        decode_raster(&record.bytes).and_then(|(format, _)| {
                            if format.to_mime_type() == record.mime_type {
                                Ok(())
                            } else {
                                Err("MIME mismatch".to_string())
                            }
                        })
                    }
                    _ => Err("Unsupported media".to_string()),
                };
                valid.map_err(|_| Phase2Failure::CorruptDatabase)?;
                Ok(MediaReply::Description {
                    mime_type: record.mime_type,
                    byte_length: record.bytes.len(),
                })
            }
            MediaAction::Read { media_id, offset } => {
                crate::database::limits::validate_media_id(&media_id)?;
                if offset > 64 * 1024 * 1024 {
                    return Err(Phase2Failure::InvalidInput);
                }
                let connection = open_connection(&session.database_path)?;
                let bytes: Vec<u8> = connection.query_row("SELECT substr(bytes, ?2, ?3) FROM media WHERE media_id = ?1 AND byte_length = length(bytes) AND byte_length BETWEEN 1 AND 67108864 AND ?4 < byte_length", rusqlite::params![media_id, offset + 1, CHUNK_BYTES, offset], |row| row.get(0))?;
                Ok(MediaReply::Chunk {
                    data: STANDARD.encode(bytes),
                })
            }
        }
    }
}
