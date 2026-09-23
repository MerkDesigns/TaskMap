use super::database_session::DatabaseSessionState;
use super::session_state_access::authorized_session;
use super::session_types::SensitiveDocument;
use crate::crypto::document_cipher::{decrypt, encrypt, NONCE_BYTES};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use crate::settings::settings_file;
use std::path::Path;
use zeroize::Zeroizing;

const LIMIT: usize = 128 * 1024;

impl DatabaseSessionState {
    // Opaque, encrypted device-local view cache. No canvas IDs/coordinates in filenames or plaintext
    // config; no new document field, database schema, media row or history/save revision.
    pub(crate) fn view_state(
        &self,
        directory: &Path,
        edition: &str,
        database_id: &str,
        session_id: &str,
        value: Option<&str>,
    ) -> Phase2Result<Option<SensitiveDocument>> {
        let mut guard = self.guard()?;
        let session = authorized_session(&mut guard, database_id, session_id)?;
        let path = directory.join(format!("view-state-{}.bin", session.database_id));
        let aad = format!("taskmap-device-view-v1|{edition}|{}", session.database_id);
        let key = session.key_state.unlocked_key()?;
        if let Some(value) = value {
            if value.len() > LIMIT {
                return Err(Phase2Failure::InvalidInput);
            }
            let encrypted = encrypt(key, value.as_bytes(), aad.as_bytes())
                .map_err(|_| Phase2Failure::Crypto)?;
            let mut bytes = encrypted.nonce.to_vec();
            bytes.extend(encrypted.ciphertext);
            settings_file::write(&path, &bytes)?;
            return Ok(None);
        }
        let Some(bytes) = settings_file::read(&path, LIMIT + NONCE_BYTES + 16)? else {
            return Ok(None);
        };
        if bytes.len() < NONCE_BYTES + 16 {
            return Err(Phase2Failure::Settings);
        }
        let plaintext: Zeroizing<Vec<u8>> = decrypt(
            key,
            &bytes[..NONCE_BYTES],
            &bytes[NONCE_BYTES..],
            aad.as_bytes(),
        )
        .map_err(|_| Phase2Failure::Settings)?;
        Ok(Some(
            SensitiveDocument::copy_from_utf8(&plaintext).map_err(|_| Phase2Failure::Settings)?,
        ))
    }
}
