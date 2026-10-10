//! Reads and writes TaskMap databases for the developer tools in `tools/`.
//!
//!   taskmap-dev-database read    unlocks a database and returns its document
//!   taskmap-dev-database write   creates a new database from a document and media
//!
//! The database format, key derivation and document encryption are the app's own: the modules
//! below are compiled in from `src-tauri`, so a written database opens exactly like one the app
//! created. Requests arrive as JSON on stdin and results leave on stdout; nothing sensitive is
//! written anywhere else.
#![allow(dead_code)]

#[path = "../../../src-tauri/src/error.rs"]
mod error;

mod crypto {
    #[path = "../../../../src-tauri/src/crypto/document_cipher.rs"]
    pub(crate) mod document_cipher;
    #[path = "../../../../src-tauri/src/crypto/key_derivation.rs"]
    pub(crate) mod key_derivation;
    #[path = "../../../../src-tauri/src/crypto/secret_key.rs"]
    pub(crate) mod secret_key;
}

mod database {
    #[path = "../../../../src-tauri/src/database/document_repository.rs"]
    pub(crate) mod document_repository;
    #[path = "../../../../src-tauri/src/database/envelope_validation.rs"]
    pub(crate) mod envelope_validation;
    #[path = "../../../../src-tauri/src/database/limits.rs"]
    pub(crate) mod limits;
    #[path = "../../../../src-tauri/src/database/schema.rs"]
    pub(crate) mod schema;
}

mod session {
    #[path = "../../../../src-tauri/src/session/session_support.rs"]
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
use rusqlite::{params, Connection, OpenFlags, Transaction};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReadRequest {
    path: PathBuf,
    password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WriteRequest {
    output: PathBuf,
    password: String,
    database_id: String,
    document: String,
    #[serde(default)]
    media: Vec<Media>,
    /// A database whose media rows are copied over unchanged, ids included.
    #[serde(default)]
    copy_media_from: Option<PathBuf>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Media {
    id: String,
    mime_type: String,
    base64: String,
}

fn main() {
    let result = match std::env::args().nth(1).as_deref() {
        Some("read") => request().and_then(run_read),
        Some("write") => request().and_then(run_write),
        _ => Err("Usage: taskmap-dev-database read|write < request.json".to_string()),
    };
    match result {
        Ok(value) => println!("{value}"),
        Err(message) => {
            println!("{}", json!({ "ok": false, "error": message }));
            std::process::exit(1);
        }
    }
}

fn request<T: DeserializeOwned>() -> Result<T, String> {
    let mut input = Zeroizing::new(String::new());
    std::io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| format!("Could not read the request: {error}"))?;
    serde_json::from_str(&input).map_err(|error| format!("Invalid request: {error}"))
}

/// Unlocks a database the way the app does and returns its current document.
fn run_read(mut request: ReadRequest) -> Result<Value, String> {
    let password = Zeroizing::new(std::mem::take(&mut request.password).into_bytes());
    if !request.path.exists() {
        return Err(format!("{} does not exist", request.path.display()));
    }
    let connection = open_read_only(&request.path)?;
    let unreadable = |_| "This is not a readable TaskMap database".to_string();
    let format = read_format_info(&connection).map_err(unreadable)?;
    let key = derive_key(&password, &format.kdf_salt, format.kdf_parameters)
        .map_err(|_| "Could not derive the database key".to_string())?;
    verify_key_check(
        &key,
        &format.key_check_nonce,
        &format.key_check_ciphertext,
        &session::key_check_aad(&format.database_id),
    )
    .map_err(|_| "Wrong password".to_string())?;
    let row = read_encrypted_document(&connection).map_err(unreadable)?;
    let plaintext = decrypt(
        &key,
        &row.nonce,
        &row.ciphertext,
        &session::document_aad(
            &format.database_id,
            row.document_schema_version,
            row.save_revision,
        ),
    )
    .map_err(|_| "The document does not decrypt".to_string())?;
    let document = std::str::from_utf8(&plaintext)
        .map_err(|_| "The document is not valid text".to_string())?;
    Ok(json!({ "ok": true, "databaseId": format.database_id, "document": document }))
}

fn run_write(mut request: WriteRequest) -> Result<Value, String> {
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

    let written = write_database(&request, &password, &document).and_then(|media| {
        verify_database(&request.output, &request.database_id, &password, &document).map(|_| media)
    });
    if written.is_err() {
        // A half-written database must not be mistaken for a finished one.
        let _ = std::fs::remove_file(&request.output);
    }
    written.map(|media| json!({ "ok": true, "media": media }))
}

fn sqlite(error: rusqlite::Error) -> String {
    format!("SQLite: {error}")
}

fn open(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path).map_err(sqlite)?;
    // The same connection settings the app's database connection uses.
    connection
        .busy_timeout(Duration::from_secs(2))
        .and_then(|_| connection.pragma_update(None, "foreign_keys", true))
        .and_then(|_| connection.pragma_update(None, "journal_mode", "DELETE"))
        .and_then(|_| connection.pragma_update(None, "synchronous", "FULL"))
        .and_then(|_| connection.pragma_update(None, "temp_store", "MEMORY"))
        .map_err(sqlite)?;
    Ok(connection)
}

/// Read-only, so a database TaskMap has open is read through SQLite's locking, never changed.
fn open_read_only(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(sqlite)?;
    connection
        .busy_timeout(Duration::from_secs(2))
        .map_err(sqlite)?;
    Ok(connection)
}

/// Mirrors the app's database creation, then stores the media under the ids the document
/// already references.
fn write_database(
    request: &WriteRequest,
    password: &[u8],
    document: &str,
) -> Result<usize, String> {
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
    let transaction = connection.transaction().map_err(sqlite)?;
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
    let mut stored = 0;
    for item in &request.media {
        let bytes = BASE64
            .decode(item.base64.as_bytes())
            .map_err(|_| format!("Media {} is not valid base64", item.id))?;
        insert_media(&transaction, &item.id, &item.mime_type, &bytes, &now)?;
        stored += 1;
    }
    if let Some(source) = &request.copy_media_from {
        let source = open_read_only(source)?;
        let mut statement = source
            .prepare("SELECT media_id, mime_type, bytes FROM media")
            .map_err(sqlite)?;
        let mut rows = statement.query([]).map_err(sqlite)?;
        while let Some(row) = rows.next().map_err(sqlite)? {
            let id: String = row.get(0).map_err(sqlite)?;
            let mime_type: String = row.get(1).map_err(sqlite)?;
            let bytes: Vec<u8> = row.get(2).map_err(sqlite)?;
            insert_media(&transaction, &id, &mime_type, &bytes, &now)?;
            stored += 1;
        }
    }
    transaction.commit().map_err(sqlite)?;
    Ok(stored)
}

fn insert_media(
    transaction: &Transaction<'_>,
    id: &str,
    mime_type: &str,
    bytes: &[u8],
    now: &str,
) -> Result<(), String> {
    validate_media_id(id).map_err(|_| format!("Invalid media id {id}"))?;
    validate_mime_type(mime_type).map_err(|_| format!("Invalid type for media {id}"))?;
    validate_media_size(bytes.len()).map_err(|_| format!("Media {id} is too large"))?;
    transaction
        .execute(
            "INSERT INTO media (
                media_id, mime_type, byte_length, content_hash, bytes, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                mime_type,
                bytes.len() as i64,
                Sha256::digest(bytes).as_slice(),
                bytes,
                now,
            ],
        )
        .map_err(|error| format!("Could not store media {id}: {error}"))?;
    Ok(())
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
