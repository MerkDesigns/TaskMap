use super::session_support::random_identifier;
use crate::database::{connection::open_connection, media_repository::load_media};
use crate::image_processing::{decode_raster, validate_gif_animation, validate_svg};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, Instant};

struct ValidatedRead {
    bytes: Vec<u8>,
    touched: Instant,
}

/// At most two validated objects (64 MiB each), matching the frontend load concurrency.
/// Tokens belong to the OpenSession and are discarded on lock/close. No SQL reads after describe.
#[derive(Default)]
pub(super) struct MediaReads(HashMap<String, ValidatedRead>);

impl MediaReads {
    pub(super) fn expire(&mut self) {
        self.0
            .retain(|_, read| read.touched.elapsed() < Duration::from_secs(60));
    }

    pub(super) fn describe(
        &mut self,
        path: &Path,
        id: &str,
    ) -> Phase2Result<(String, String, usize)> {
        self.expire();
        if self.0.len() >= 2 {
            return Err(Phase2Failure::InvalidInput);
        }
        let connection = open_connection(path)?;
        // The shape/size preflight and byte/hash query must see the same SQLite snapshot too.
        let transaction = connection.unchecked_transaction()?;
        let record = load_media(&transaction, id)?;
        transaction.commit()?;
        let valid = match record.mime_type.as_str() {
            "image/svg+xml" => validate_svg(&record.bytes).map(|_| ()),
            "image/gif" => validate_gif_animation(&record.bytes).map(|_| ()),
            "image/webp" | "image/png" | "image/jpeg" | "image/bmp" => decode_raster(&record.bytes)
                .and_then(|(format, _)| {
                    if format.to_mime_type() == record.mime_type {
                        Ok(())
                    } else {
                        Err("MIME mismatch".to_string())
                    }
                }),
            _ => Err("Unsupported media".to_string()),
        };
        valid.map_err(|_| Phase2Failure::CorruptDatabase)?;
        let token = random_identifier();
        let length = record.bytes.len();
        self.0.insert(
            token.clone(),
            ValidatedRead {
                bytes: record.bytes,
                touched: Instant::now(),
            },
        );
        Ok((token, record.mime_type, length))
    }

    pub(super) fn read(&mut self, token: &str, offset: usize) -> Phase2Result<Vec<u8>> {
        self.expire();
        let read = self.0.get_mut(token).ok_or(Phase2Failure::InvalidInput)?;
        if offset >= read.bytes.len() {
            return Err(Phase2Failure::InvalidInput);
        }
        let end = (offset + super::session_media_transfer::CHUNK_BYTES).min(read.bytes.len());
        let bytes = read.bytes[offset..end].to_vec();
        read.touched = Instant::now();
        if end == read.bytes.len() {
            self.0.remove(token);
        }
        Ok(bytes)
    }

    pub(super) fn release(&mut self, token: &str) {
        self.0.remove(token);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abandoned_reads_expire_and_explicit_release_frees_capacity() {
        let mut reads = MediaReads::default();
        reads.0.insert(
            "expired".into(),
            ValidatedRead {
                bytes: vec![1],
                touched: Instant::now() - Duration::from_secs(61),
            },
        );
        reads.0.insert(
            "live".into(),
            ValidatedRead {
                bytes: vec![2],
                touched: Instant::now(),
            },
        );
        assert!(reads.read("expired", 0).is_err());
        assert_eq!(reads.0.len(), 1);
        reads.release("live");
        reads.release("live");
        assert!(reads.0.is_empty());
    }
}
