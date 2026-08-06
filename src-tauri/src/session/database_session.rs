use super::session_key_state::SessionKeyState;
use super::session_opening::{create_open_session, open_locked_session, unlock_open_session};
use super::session_state_access::{ensure_no_open_session, status_from_guard, unlocked_session};
use super::session_support::{
    document_aad, map_document_cipher_failure, random_identifier, timestamp,
};
use super::session_types::{
    DatabaseSessionStatus, LoadedDocument, PendingLoadedDocument, SavedDocument, SensitiveDocument,
};
use crate::crypto::document_cipher::{decrypt, encrypt};
use crate::database::connection::open_connection;
use crate::database::document_repository::{
    read_encrypted_document, save_document_transaction, EncryptedDocumentRow,
};
use crate::database::limits::validate_document_size;
use crate::files::database_lock::DatabaseWriterLock;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

pub(super) struct OpenSession {
    pub(super) session_id: String,
    pub(super) database_path: PathBuf,
    pub(super) database_id: String,
    pub(super) document_schema_version: i64,
    pub(super) revision: i64,
    pub(super) key_state: SessionKeyState,
    pub(super) _writer_lock: DatabaseWriterLock,
    pub(super) last_activity_at: String,
}

#[derive(Clone, Default)]
pub(crate) struct DatabaseSessionState {
    pub(super) inner: Arc<Mutex<Option<OpenSession>>>,
}

impl DatabaseSessionState {
    pub(crate) fn create_database(
        &self,
        database_path: PathBuf,
        database_id: String,
        document_schema_version: i64,
        serialized_document: &str,
        password: &[u8],
        edition: &str,
    ) -> Phase2Result<PendingLoadedDocument> {
        let mut guard = self.guard()?;
        ensure_no_open_session(&guard)?;
        let (session, confirmation_token) = create_open_session(
            database_path,
            database_id,
            document_schema_version,
            serialized_document,
            password,
            edition,
        )?;
        *guard = Some(session);
        Ok(PendingLoadedDocument {
            serialized_document: SensitiveDocument::new(serialized_document.to_string()),
            revision: 1,
            session: status_from_guard(&guard),
            confirmation_token,
            recovered_from_revision: None,
            warnings: Vec::new(),
        })
    }

    pub(crate) fn open_database(
        &self,
        database_path: PathBuf,
        edition: &str,
    ) -> Phase2Result<DatabaseSessionStatus> {
        let mut guard = self.guard()?;
        ensure_no_open_session(&guard)?;
        *guard = Some(open_locked_session(database_path, edition)?);
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn unlock_database(&self, password: &[u8]) -> Phase2Result<PendingLoadedDocument> {
        let mut guard = self.guard()?;
        let session = guard.as_mut().ok_or(Phase2Failure::SessionNotOpen)?;
        if !session.key_state.is_locked() {
            return Err(Phase2Failure::SessionLocked);
        }
        let candidate = unlock_open_session(session, password)?;
        let confirmation_token = random_identifier();
        session.revision = candidate.revision;
        session.last_activity_at = timestamp();
        session.key_state = SessionKeyState::pending(candidate.key, confirmation_token.clone());
        Ok(PendingLoadedDocument {
            serialized_document: candidate.serialized_document,
            revision: candidate.revision,
            session: status_from_guard(&guard),
            confirmation_token,
            recovered_from_revision: candidate.recovered_from_revision,
            warnings: Vec::new(),
        })
    }

    pub(crate) fn confirm_unlock(
        &self,
        confirmation_token: &str,
        database_id: &str,
    ) -> Phase2Result<DatabaseSessionStatus> {
        let mut guard = self.guard()?;
        if guard
            .as_ref()
            .is_none_or(|session| session.database_id != database_id)
        {
            *guard = None;
            return Err(Phase2Failure::CorruptDatabase);
        }
        let result = guard
            .as_mut()
            .ok_or(Phase2Failure::SessionNotOpen)?
            .key_state
            .confirm(confirmation_token);
        if result.is_err() {
            *guard = None;
            return result.map(|()| status_from_guard(&guard));
        }
        if let Some(session) = guard.as_mut() {
            session.last_activity_at = timestamp();
        }
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn cancel_pending_unlock(
        &self,
        confirmation_token: &str,
    ) -> Phase2Result<DatabaseSessionStatus> {
        let mut guard = self.guard()?;
        let session = guard.as_ref().ok_or(Phase2Failure::SessionNotOpen)?;
        if !session.key_state.pending_matches(confirmation_token) {
            *guard = None;
            return Err(Phase2Failure::SessionLocked);
        }
        *guard = None;
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn expire_pending_unlock(&self, confirmation_token: &str) -> bool {
        let mut guard = match self.inner.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                let mut guard = poisoned.into_inner();
                *guard = None;
                return true;
            }
        };
        let should_close = guard
            .as_ref()
            .is_some_and(|session| session.key_state.pending_expired(confirmation_token));
        if should_close {
            *guard = None;
        }
        should_close
    }

    #[cfg(test)]
    pub(crate) fn force_pending_expired(&self) {
        if let Ok(mut guard) = self.guard() {
            if let Some(session) = guard.as_mut() {
                session.key_state.force_pending_expired();
            }
        }
    }

    pub(crate) fn read_document(&self) -> Phase2Result<LoadedDocument> {
        let mut guard = self.guard()?;
        let loaded = (|| {
            let session = unlocked_session(&mut guard)?;
            let connection = open_connection(&session.database_path)?;
            let encrypted = read_encrypted_document(&connection)?;
            let plaintext = decrypt(
                session.key_state.unlocked_key()?,
                &encrypted.nonce,
                &encrypted.ciphertext,
                &document_aad(
                    &session.database_id,
                    encrypted.document_schema_version,
                    encrypted.save_revision,
                ),
            )
            .map_err(map_document_cipher_failure)?;
            validate_document_size(plaintext.len())?;
            let serialized_document = SensitiveDocument::copy_from_utf8(&plaintext)
                .map_err(|_| Phase2Failure::InvalidDocumentPayload)?;
            Ok((serialized_document, encrypted.save_revision))
        })();
        let (serialized_document, revision) = match loaded {
            Ok(loaded) => loaded,
            Err(error) => {
                if !matches!(
                    &error,
                    Phase2Failure::SessionLocked | Phase2Failure::SessionNotOpen
                ) {
                    *guard = None;
                }
                return Err(error);
            }
        };
        let session = unlocked_session(&mut guard)?;
        session.revision = revision;
        session.last_activity_at = timestamp();
        Ok(LoadedDocument {
            serialized_document,
            revision: session.revision,
            session: status_from_guard(&guard),
        })
    }

    pub(crate) fn save_document(
        &self,
        serialized_document: &str,
        expected_revision: i64,
    ) -> Phase2Result<SavedDocument> {
        validate_document_size(serialized_document.len())?;
        let mut guard = self.guard()?;
        let session = unlocked_session(&mut guard)?;
        if session.revision != expected_revision {
            return Err(Phase2Failure::RevisionConflict);
        }
        let revision = expected_revision
            .checked_add(1)
            .ok_or(Phase2Failure::SaveFailure)?;
        let encrypted = encrypt(
            session.key_state.unlocked_key()?,
            serialized_document.as_bytes(),
            &document_aad(
                &session.database_id,
                session.document_schema_version,
                revision,
            ),
        )
        .map_err(|_| Phase2Failure::Crypto)?;
        let now = timestamp();
        let mut connection = open_connection(&session.database_path)?;
        let save_result = save_document_transaction(
            &mut connection,
            &EncryptedDocumentRow {
                document_schema_version: session.document_schema_version,
                nonce: encrypted.nonce.to_vec(),
                ciphertext: encrypted.ciphertext,
                save_revision: revision,
                updated_at: now.clone(),
            },
            expected_revision,
        );
        if let Err(error) = save_result {
            drop(connection);
            if matches!(error, Phase2Failure::SaveFailure) {
                *guard = None;
            }
            return Err(error);
        }
        session.revision = revision;
        session.last_activity_at = now;
        Ok(SavedDocument {
            revision,
            session: status_from_guard(&guard),
        })
    }

    pub(super) fn guard(&self) -> Phase2Result<MutexGuard<'_, Option<OpenSession>>> {
        self.inner.lock().map_err(|_| Phase2Failure::Internal)
    }
}
