use super::database_session::OpenSession;
use super::session_key_state::SessionKeyState;
use super::session_support::{
    document_aad, key_check_aad, map_document_cipher_failure, random_identifier, timestamp,
    validate_create_input, validate_create_password, validate_document_versions,
};
use super::session_types::SensitiveDocument;
use crate::crypto::document_cipher::{create_key_check, decrypt, encrypt, verify_key_check};
use crate::crypto::key_derivation::{derive_key, KdfParameters, ARGON2_VERSION, KDF_SALT_BYTES};
use crate::crypto::secret_key::{SecretKey, DOCUMENT_KEY_BYTES};
use crate::database::connection::{open_connection, ReservedDatabase};
use crate::database::document_repository::{
    insert_initial_document, read_encrypted_document, read_format_info, read_recovery_documents,
    EncryptedDocumentRow,
};
use crate::database::limits::validate_document_size;
use crate::database::schema::{create_schema, insert_format_info, NewFormatInfo};
use crate::files::database_lock::{DatabaseWriterLock, LockOwner};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use rand::{rngs::OsRng, RngCore};
use std::path::PathBuf;
use zeroize::Zeroizing;

pub(super) struct UnlockCandidate {
    pub(super) key: SecretKey,
    pub(super) serialized_document: SensitiveDocument,
    pub(super) revision: i64,
    pub(super) recovered_from_revision: Option<i64>,
}

pub(super) fn create_open_session(
    requested_path: PathBuf,
    database_id: String,
    document_schema_version: i64,
    serialized_document: &str,
    password: &[u8],
    edition: &str,
) -> Phase2Result<(OpenSession, String)> {
    validate_create_input(&database_id, document_schema_version, serialized_document)?;
    validate_create_password(password)?;
    let reserved = ReservedDatabase::reserve(&requested_path)?;
    let database_path = reserved.path().to_path_buf();
    let now = timestamp();
    let session_id = random_identifier();
    let writer_lock = match acquire_writer_lock(&database_path, edition, &session_id, &now) {
        Ok(lock) => lock,
        Err(error) => {
            reserved.cleanup()?;
            return Err(error);
        }
    };

    let initialization = initialize_database(
        &database_path,
        &database_id,
        document_schema_version,
        serialized_document,
        password,
        &now,
    );
    let key = match initialization {
        Ok(key) => key,
        Err(error) => {
            drop(writer_lock);
            reserved.cleanup()?;
            return Err(error);
        }
    };
    let database_path = reserved.commit();
    let confirmation_token = random_identifier();
    Ok((
        OpenSession {
            session_id,
            database_path,
            database_id,
            document_schema_version,
            revision: 1,
            key_state: SessionKeyState::pending(key, confirmation_token.clone()),
            _writer_lock: writer_lock,
            last_activity_at: now,
        },
        confirmation_token,
    ))
}

fn initialize_database(
    database_path: &std::path::Path,
    database_id: &str,
    document_schema_version: i64,
    serialized_document: &str,
    password: &[u8],
    now: &str,
) -> Phase2Result<SecretKey> {
    let mut salt = Zeroizing::new([0_u8; KDF_SALT_BYTES]);
    OsRng.fill_bytes(salt.as_mut());
    let parameters = KdfParameters::default();
    let key = derive_key(password, salt.as_ref(), parameters)?;
    let key_check =
        create_key_check(&key, &key_check_aad(database_id)).map_err(|_| Phase2Failure::Crypto)?;
    let encrypted = encrypt(
        &key,
        serialized_document.as_bytes(),
        &document_aad(database_id, document_schema_version, 1),
    )
    .map_err(|_| Phase2Failure::Crypto)?;
    let mut connection = open_connection(database_path)?;
    let transaction = connection.transaction()?;
    create_schema(&transaction)?;
    insert_format_info(
        &transaction,
        &NewFormatInfo {
            database_id,
            document_schema_version,
            created_at: now,
            kdf_salt: salt.as_ref(),
            kdf_version: ARGON2_VERSION,
            kdf_memory_kib: parameters.memory_kib,
            kdf_iterations: parameters.iterations,
            kdf_parallelism: parameters.parallelism,
            kdf_output_bytes: DOCUMENT_KEY_BYTES,
            key_check_nonce: &key_check.nonce,
            key_check_ciphertext: &key_check.ciphertext,
        },
    )?;
    insert_initial_document(
        &transaction,
        &EncryptedDocumentRow {
            document_schema_version,
            nonce: encrypted.nonce.to_vec(),
            ciphertext: encrypted.ciphertext,
            save_revision: 1,
            updated_at: now.to_string(),
        },
    )?;
    transaction.commit()?;
    Ok(key)
}

pub(super) fn open_locked_session(
    database_path: PathBuf,
    edition: &str,
) -> Phase2Result<OpenSession> {
    let now = timestamp();
    let session_id = random_identifier();
    let writer_lock = acquire_writer_lock(&database_path, edition, &session_id, &now)?;
    let connection = open_connection(&database_path)?;
    let format = read_format_info(&connection)?;
    let document = read_encrypted_document(&connection)?;
    validate_document_versions(
        format.document_schema_version,
        document.document_schema_version,
    )?;
    Ok(OpenSession {
        session_id,
        database_path: std::fs::canonicalize(database_path).map_err(Phase2Failure::from_io)?,
        database_id: format.database_id,
        document_schema_version: document.document_schema_version,
        revision: document.save_revision,
        key_state: SessionKeyState::Locked,
        _writer_lock: writer_lock,
        last_activity_at: now,
    })
}

pub(super) fn unlock_open_session(
    session: &OpenSession,
    password: &[u8],
) -> Phase2Result<UnlockCandidate> {
    let connection = open_connection(&session.database_path)?;
    let format = read_format_info(&connection)?;
    if format.database_id != session.database_id {
        return Err(Phase2Failure::CorruptDatabase);
    }
    let encrypted = read_encrypted_document(&connection)?;
    validate_document_versions(
        format.document_schema_version,
        encrypted.document_schema_version,
    )?;
    let key = derive_key(password, &format.kdf_salt, format.kdf_parameters)?;
    verify_key_check(
        &key,
        &format.key_check_nonce,
        &format.key_check_ciphertext,
        &key_check_aad(&format.database_id),
    )
    .map_err(|_| Phase2Failure::WrongPassword)?;

    if let Ok(serialized_document) = decrypt_document(&key, &format.database_id, &encrypted) {
        return Ok(UnlockCandidate {
            key,
            serialized_document,
            revision: encrypted.save_revision,
            recovered_from_revision: None,
        });
    }
    for recovery in read_recovery_documents(&connection)? {
        if let Ok(serialized_document) = decrypt_document(&key, &format.database_id, &recovery) {
            return Ok(UnlockCandidate {
                key,
                serialized_document,
                revision: encrypted.save_revision,
                recovered_from_revision: Some(recovery.save_revision),
            });
        }
    }
    Err(Phase2Failure::CorruptDatabase)
}

fn decrypt_document(
    key: &SecretKey,
    database_id: &str,
    encrypted: &EncryptedDocumentRow,
) -> Phase2Result<SensitiveDocument> {
    let plaintext = decrypt(
        key,
        &encrypted.nonce,
        &encrypted.ciphertext,
        &document_aad(
            database_id,
            encrypted.document_schema_version,
            encrypted.save_revision,
        ),
    )
    .map_err(map_document_cipher_failure)?;
    validate_document_size(plaintext.len())?;
    SensitiveDocument::copy_from_utf8(&plaintext).map_err(|_| Phase2Failure::InvalidDocumentPayload)
}

fn acquire_writer_lock(
    database_path: &std::path::Path,
    edition: &str,
    session_id: &str,
    opened_at: &str,
) -> Phase2Result<DatabaseWriterLock> {
    DatabaseWriterLock::acquire(
        database_path,
        &LockOwner {
            edition: edition.to_string(),
            process_id: std::process::id(),
            session_id: session_id.to_string(),
            opened_at: opened_at.to_string(),
        },
    )
}
