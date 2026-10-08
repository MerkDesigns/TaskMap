//! Writes one migrated TaskMap document and its media into a new encrypted database.
//!
//! The database format, key derivation and document encryption are the app's own: the modules
//! below are compiled in from `src-tauri`, so the result opens exactly like a database the app
//! created. The request arrives as JSON on stdin; nothing sensitive is written anywhere else.
#![allow(dead_code)]

#[path = "../../../../src-tauri/src/error.rs"]
mod error;

mod crypto {
    #[path = "../../../../../src-tauri/src/crypto/document_cipher.rs"]
    pub(crate) mod document_cipher;
    #[path = "../../../../../src-tauri/src/crypto/key_derivation.rs"]
    pub(crate) mod key_derivation;
    #[path = "../../../../../src-tauri/src/crypto/secret_key.rs"]
    pub(crate) mod secret_key;
}

mod database {
    #[path = "../../../../../src-tauri/src/database/document_repository.rs"]
    pub(crate) mod document_repository;
    #[path = "../../../../../src-tauri/src/database/envelope_validation.rs"]
    pub(crate) mod envelope_validation;
    #[path = "../../../../../src-tauri/src/database/limits.rs"]
    pub(crate) mod limits;
    #[path = "../../../../../src-tauri/src/database/schema.rs"]
    pub(crate) mod schema;
}

mod session {
    #[path = "../../../../../src-tauri/src/session/session_support.rs"]
    mod session_support;

    pub(crate) fn document_aad(database_id: &str, schema_version: i64, revision: i64) -> Vec<u8> {
        session_support::document_aad(database_id, schema_version, revision)
    }

    pub(crate) fn key_check_aad(database_id: &str) -> Vec<u8> {
        session_support::key_check_aad(database_id)
    }

    pub(crate) fn timestamp() -> String {
        session_support::timestamp()
    }
}

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use crypto::document_cipher::{create_key_check, decrypt, encrypt, verify_key_check};
use crypto::key_derivation::{derive_key, KdfParameters, ARGON2_VERSION, KDF_SALT_BYTES};
use crypto::secret_key::DOCUMENT_KEY_BYTES;
use database::document_repository::{
    insert_initial_document, read_encrypted_document, read_format_info, EncryptedDocumentRow,
};
use database::limits::{
    validate_database_id, validate_document_size, validate_media_id, validate_media_size,
    validate_mime_type, validate_password,
};
use database::schema::{
    create_schema, insert_format_info, NewFormatInfo, CURRENT_DOCUMENT_SCHEMA_VERSION,
};
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    output: PathBuf,
    password: String,
    database_id: String,
    document: String,
    media: Vec<Media>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Media {
    id: String,
    mime_type: String,
    base64: String,
}

fn main() {
    match run() {
        Ok(media) => println!("{}", serde_json::json!({ "ok": true, "media": media })),
        Err(message) => {
            println!("{}", serde_json::json!({ "ok": false, "error": message }));
            std::process::exit(1);
        }
    }
}

fn run() -> Result<usize, String> {
    let mut input = Zeroizing::new(String::new());
    std::io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| format!("Could not read the request: {error}"))?;
    let mut request: Request =
        serde_json::from_str(&input).map_err(|error| format!("Invalid request: {error}"))?;
    let password = Zeroizing::new(std::mem::take(&mut request.password).into_bytes());
    let document = Zeroizing::new(std::mem::take(&mut request.document));

    validate_password(&password).map_err(|_| "The new password is not allowed".to_string())?;
    validate_database_id(&request.database_id).map_err(|_| "Invalid database id".to_string())?;
    validate_document_size(document.len()).map_err(|_| "The document is too large".to_string())?;
    if request.output.exists() {
        return Err(format!(
            "{} already exists; choose a new file",
            request.output.display()
        ));
    }

    let written = write_database(&request, &password, &document)
        .and_then(|media| {
            verify_database(&request.output, &request.database_id, &password, &document)
                .map(|_| media)
        });
    if written.is_err() {
        // A half-written database must not be mistaken for a finished one.
        let _ = std::fs::remove_file(&request.output);
    }
    written
}

fn open(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(|error| format!("SQLite: {error}"))?;
    // The same connection settings the app's database connection uses.
    connection
        .busy_timeout(Duration::from_secs(2))
        .and_then(|_| connection.pragma_update(None, "foreign_keys", true))
        .and_then(|_| connection.pragma_update(None, "journal_mode", "DELETE"))
        .and_then(|_| connection.pragma_update(None, "synchronous", "FULL"))
        .and_then(|_| connection.pragma_update(None, "temp_store", "MEMORY"))
        .map_err(|error| format!("SQLite: {error}"))?;
    Ok(connection)
}

/// Mirrors the app's database creation, then stores every media item under the id the document
/// already references.
fn write_database(request: &Request, password: &[u8], document: &str) -> Result<usize, String> {
    let now = session::timestamp();
    let mut salt = Zeroizing::new([0_u8; KDF_SALT_BYTES]);
    OsRng.fill_bytes(salt.as_mut());
    let parameters = KdfParameters::default();
    let key = derive_key(password, salt.as_ref(), parameters)
        .map_err(|_| "Could not derive the database key".to_string())?;
    let database_id = request.database_id.as_str();
    let key_check = create_key_check(&key, &session::key_check_aad(database_id))
        .map_err(|_| "Could not create the key check".to_string())?;
    let encrypted = encrypt(
        &key,
        document.as_bytes(),
        &session::document_aad(database_id, CURRENT_DOCUMENT_SCHEMA_VERSION, 1),
    )
    .map_err(|_| "Could not encrypt the document".to_string())?;

    let mut connection = open(&request.output)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("SQLite: {error}"))?;
    let failed = |_| "Could not write the database".to_string();
    create_schema(&transaction).map_err(failed)?;
    insert_format_info(
        &transaction,
        &NewFormatInfo {
            database_id,
            document_schema_version: CURRENT_DOCUMENT_SCHEMA_VERSION,
            created_at: &now,
            kdf_salt: salt.as_ref(),
            kdf_version: ARGON2_VERSION,
            kdf_memory_kib: parameters.memory_kib,
            kdf_iterations: parameters.iterations,
            kdf_parallelism: parameters.parallelism,
            kdf_output_bytes: DOCUMENT_KEY_BYTES,
            key_check_nonce: &key_check.nonce,
            key_check_ciphertext: &key_check.ciphertext,
        },
    )
    .map_err(failed)?;
    insert_initial_document(
        &transaction,
        &EncryptedDocumentRow {
            document_schema_version: CURRENT_DOCUMENT_SCHEMA_VERSION,
            nonce: encrypted.nonce.to_vec(),
            ciphertext: encrypted.ciphertext,
            save_revision: 1,
            updated_at: now.clone(),
        },
    )
    .map_err(failed)?;
    for item in &request.media {
        let bytes = BASE64
            .decode(item.base64.as_bytes())
            .map_err(|_| format!("Media {} is not valid base64", item.id))?;
        validate_media_id(&item.id).map_err(|_| format!("Invalid media id {}", item.id))?;
        validate_mime_type(&item.mime_type)
            .map_err(|_| format!("Invalid type for media {}", item.id))?;
        validate_media_size(bytes.len())
            .map_err(|_| format!("Media {} is too large", item.id))?;
        transaction
            .execute(
                "INSERT INTO media (
                    media_id, mime_type, byte_length, content_hash, bytes, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    item.id,
                    item.mime_type,
                    bytes.len() as i64,
                    Sha256::digest(&bytes).as_slice(),
                    bytes,
                    now,
                ],
            )
            .map_err(|error| format!("Could not store media {}: {error}", item.id))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("SQLite: {error}"))?;
    Ok(request.media.len())
}

/// Reopens the new database the way unlocking does and checks the document comes back intact.
fn verify_database(
    path: &Path,
    database_id: &str,
    password: &[u8],
    document: &str,
) -> Result<(), String> {
    let connection = open(path)?;
    let unreadable = |_| "The new database could not be read back".to_string();
    let format = read_format_info(&connection).map_err(unreadable)?;
    if format.database_id != database_id {
        return Err("The new database has the wrong id".into());
    }
    let key = derive_key(password, &format.kdf_salt, format.kdf_parameters).map_err(unreadable)?;
    verify_key_check(
        &key,
        &format.key_check_nonce,
        &format.key_check_ciphertext,
        &session::key_check_aad(database_id),
    )
    .map_err(|_| "The new password does not unlock the database".to_string())?;
    let row = read_encrypted_document(&connection).map_err(unreadable)?;
    let plaintext = decrypt(
        &key,
        &row.nonce,
        &row.ciphertext,
        &session::document_aad(database_id, row.document_schema_version, row.save_revision),
    )
    .map_err(|_| "The new database's document does not decrypt".to_string())?;
    if plaintext.as_slice() != document.as_bytes() {
        return Err("The new database's document does not match what was written".into());
    }
    Ok(())
}
