use crate::error::{command_result, CommandResult};
use crate::model::{
    migrate_app_data, validate_app_data_v1, validate_canvas_content_payload, AppData,
    APP_DATA_SCHEMA_VERSION, CANVAS_CONTENT_FIELDS,
};
use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const APP_STATE_KEY: &str = "app_state";
const APP_METADATA_KEY: &str = "app_metadata_v2";
const CANVAS_KEY_PREFIX: &str = "canvas_v2:";
const KEYRING_SERVICE: &str = "TaskMap";
const KEYRING_USER: &str = "app-data-key";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct EncryptedPayload {
    pub(crate) version: u8,
    pub(crate) nonce: String,
    pub(crate) ciphertext: String,
}

#[derive(Default)]
pub(crate) struct StorageSession {
    database_key: Option<[u8; 32]>,
    key_creation_blocked: bool,
}

#[derive(Default)]
pub(crate) struct StorageState {
    session: Mutex<StorageSession>,
}

fn lock_storage(storage: &StorageState) -> std::sync::MutexGuard<'_, StorageSession> {
    match storage.session.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

pub(crate) fn with_storage<T>(
    app: &tauri::AppHandle,
    operation: impl FnOnce(&mut StorageSession) -> Result<T, String>,
) -> Result<T, String> {
    let storage = app.state::<StorageState>();
    let mut session = lock_storage(&storage);
    operation(&mut session)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    Ok(data_dir.join("taskmap.sqlite3"))
}

fn backup_database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    Ok(data_dir.join(format!("taskmap-unreadable-{timestamp}.sqlite3")))
}

pub(crate) fn database_error(error: impl std::fmt::Display) -> String {
    format!("Database error: {error}")
}

pub(crate) fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?).map_err(database_error)?;
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS app_data (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(database_error)?;
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS images (
                hash TEXT PRIMARY KEY,
                format TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                bytes BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(database_error)?;
    Ok(connection)
}

pub(crate) fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0_u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

fn decode_database_key(encoded: String) -> Result<[u8; 32], String> {
    let decoded = BASE64
        .decode(encoded.trim())
        .map_err(|error| format!("Stored database key credential is unreadable: {error}"))?;
    decoded
        .try_into()
        .map_err(|_| "Stored database key has an invalid length".to_string())
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|error| format!("Could not open keyring: {error}"))
}

fn delete_keyring_key() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Could not delete database key from keyring: {error}"
        )),
    }
}

pub(crate) fn get_database_key(
    session: &mut StorageSession,
    create: bool,
) -> Result<[u8; 32], String> {
    if let Some(key) = session.database_key {
        return Ok(key);
    }

    let entry = keyring_entry()?;
    let key =
        match entry.get_password() {
            Ok(password) => decode_database_key(password)?,
            Err(keyring::Error::NoEntry) if create && !session.key_creation_blocked => {
                let key = random_bytes::<32>();
                entry.set_password(&BASE64.encode(key)).map_err(|error| {
                    format!("Could not save generated database key to keyring: {error}")
                })?;
                key
            }
            Err(keyring::Error::NoEntry) => return Err(
                "Encrypted app data exists, but no database key was found in the system keyring."
                    .to_string(),
            ),
            Err(keyring::Error::BadEncoding(_)) => {
                return Err(
                    "Stored database key credential is unreadable: keyring value is not UTF-8"
                        .to_string(),
                )
            }
            Err(error) => return Err(format!("Could not read database key from keyring: {error}")),
        };

    session.database_key = Some(key);
    Ok(key)
}

fn database_has_encrypted_data(connection: &Connection) -> Result<bool, String> {
    let app_data_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM app_data", [], |row| row.get(0))
        .map_err(database_error)?;
    let image_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))
        .map_err(database_error)?;
    Ok(app_data_count > 0 || image_count > 0)
}

pub(crate) fn initialize_storage(app: &tauri::AppHandle) -> Result<(), String> {
    with_storage(app, |session| {
        let connection = open_database(app)?;
        session.key_creation_blocked = database_has_encrypted_data(&connection)?;
        let create = !session.key_creation_blocked;
        get_database_key(session, create)?;
        Ok(())
    })
}

pub(crate) fn encrypt_with_key(
    plaintext: &[u8],
    key: &[u8; 32],
) -> Result<EncryptedPayload, String> {
    let nonce_bytes = random_bytes::<12>();
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|error| format!("Could not encrypt app data: {error}"))?;

    Ok(EncryptedPayload {
        version: 1,
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    })
}

pub(crate) fn decrypt_with_key(
    payload: &EncryptedPayload,
    key: &[u8; 32],
) -> Result<Vec<u8>, String> {
    if payload.version != 1 {
        return Err("Unsupported encrypted app data version".to_string());
    }

    let nonce = BASE64
        .decode(&payload.nonce)
        .map_err(|error| format!("Stored nonce is invalid: {error}"))?;
    if nonce.len() != 12 {
        return Err("Stored nonce has an invalid length".to_string());
    }

    let ciphertext = BASE64
        .decode(&payload.ciphertext)
        .map_err(|error| format!("Stored app data is invalid: {error}"))?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;

    cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|error| format!("Could not decrypt app data: {error}"))
}

fn encrypt_database_value(data: &AppData, key: &[u8; 32]) -> Result<String, String> {
    let plaintext = serde_json::to_vec(data).map_err(|error| error.to_string())?;
    let encrypted = encrypt_with_key(&plaintext, key)?;
    serde_json::to_string(&encrypted).map_err(|error| error.to_string())
}

fn decrypt_database_value(value: &str, key: &[u8; 32]) -> Result<AppData, String> {
    let encrypted: EncryptedPayload = serde_json::from_str(value)
        .map_err(|error| format!("Stored app data is invalid: {error}"))?;
    let plaintext = decrypt_with_key(&encrypted, key)?;
    serde_json::from_slice(&plaintext).map_err(|error| format!("App data JSON is invalid: {error}"))
}

fn query_app_data_value(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row("SELECT value FROM app_data WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(database_error)
}

fn upsert_app_data_value(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO app_data (key, value, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP",
            params![key, value],
        )
        .map_err(database_error)?;
    Ok(())
}

fn canvas_id(canvas: &AppData) -> Option<&str> {
    canvas.get("id").and_then(serde_json::Value::as_str)
}

fn canvas_storage_key(id: &str) -> String {
    format!("{CANVAS_KEY_PREFIX}{id}")
}

fn canvas_shell(canvas: &AppData) -> AppData {
    let mut shell = canvas.clone();
    if let Some(object) = shell.as_object_mut() {
        for field in CANVAS_CONTENT_FIELDS {
            object.insert(field.to_string(), serde_json::Value::Array(Vec::new()));
        }
    }
    shell
}

fn canvas_content(canvas: &AppData) -> Option<AppData> {
    let id = canvas_id(canvas)?;
    let mut content = serde_json::Map::new();
    content.insert("id".to_string(), serde_json::Value::String(id.to_string()));
    for field in CANVAS_CONTENT_FIELDS {
        content.insert(
            field.to_string(),
            canvas
                .get(field)
                .cloned()
                .unwrap_or_else(|| serde_json::Value::Array(Vec::new())),
        );
    }
    Some(serde_json::Value::Object(content))
}

fn split_app_data(data: &AppData) -> (AppData, Vec<AppData>) {
    let mut metadata = data.clone();
    let canvases = data
        .get("canvases")
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();

    if let Some(metadata_canvases) = metadata
        .get_mut("canvases")
        .and_then(serde_json::Value::as_array_mut)
    {
        *metadata_canvases = canvases.iter().map(canvas_shell).collect();
    }

    let contents = canvases.iter().filter_map(canvas_content).collect();
    (metadata, contents)
}

fn merge_canvas_content(shell: &mut AppData, content: &AppData) {
    let Some(shell_object) = shell.as_object_mut() else {
        return;
    };
    for field in CANVAS_CONTENT_FIELDS {
        if let Some(value) = content.get(field) {
            shell_object.insert(field.to_string(), value.clone());
        }
    }
}

fn save_split_app_data_in_transaction(
    transaction: &rusqlite::Transaction<'_>,
    key: &[u8; 32],
    metadata: &AppData,
    canvases: &[AppData],
) -> Result<(), String> {
    let metadata = migrate_app_data(metadata.clone())?;
    let (metadata, _) = split_app_data(&metadata);
    let valid_canvas_ids: HashSet<String> = metadata
        .get("canvases")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(canvas_id)
        .map(str::to_string)
        .collect();
    let valid_canvas_keys: HashSet<String> = valid_canvas_ids
        .iter()
        .map(|id| canvas_storage_key(id))
        .collect();
    let encrypted_metadata = encrypt_database_value(&metadata, key)?;
    let mut supplied_ids = HashSet::new();
    let mut encrypted_canvases = Vec::with_capacity(canvases.len());
    for canvas in canvases {
        let id = validate_canvas_content_payload(canvas)?;
        if !valid_canvas_ids.contains(id) {
            return Err(format!(
                "Canvas content {id} is not present in app metadata"
            ));
        }
        if !supplied_ids.insert(id.to_string()) {
            return Err(format!("Canvas content {id} was supplied more than once"));
        }
        let content = canvas_content(canvas)
            .ok_or_else(|| format!("Canvas content {id} could not be serialized"))?;
        encrypted_canvases.push((
            canvas_storage_key(id),
            encrypt_database_value(&content, key)?,
        ));
    }

    let stored_canvas_keys: Vec<String> = {
        let mut statement = transaction
            .prepare("SELECT key FROM app_data WHERE key LIKE ?1")
            .map_err(database_error)?;
        let rows = statement
            .query_map([format!("{CANVAS_KEY_PREFIX}%")], |row| row.get(0))
            .map_err(database_error)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(database_error)?
    };
    let stored_canvas_key_set: HashSet<&str> =
        stored_canvas_keys.iter().map(String::as_str).collect();
    for canvas_id in &valid_canvas_ids {
        let storage_key = canvas_storage_key(canvas_id);
        if !supplied_ids.contains(canvas_id)
            && !stored_canvas_key_set.contains(storage_key.as_str())
        {
            return Err(format!(
                "Canvas {canvas_id} has no existing or supplied content row"
            ));
        }
    }

    upsert_app_data_value(transaction, APP_METADATA_KEY, &encrypted_metadata)?;
    for (storage_key, value) in encrypted_canvases {
        upsert_app_data_value(transaction, &storage_key, &value)?;
    }

    for stored_key in stored_canvas_keys {
        if !valid_canvas_keys.contains(&stored_key) {
            transaction
                .execute("DELETE FROM app_data WHERE key = ?1", [&stored_key])
                .map_err(database_error)?;
        }
    }
    transaction
        .execute("DELETE FROM app_data WHERE key = ?1", [APP_STATE_KEY])
        .map_err(database_error)?;
    Ok(())
}

pub(crate) fn save_app_data_in_transaction(
    transaction: &rusqlite::Transaction<'_>,
    key: &[u8; 32],
    data: &AppData,
) -> Result<(), String> {
    let (metadata, canvases) = split_app_data(data);
    save_split_app_data_in_transaction(transaction, key, &metadata, &canvases)
}

fn save_split_app_data_to_database(
    app: &tauri::AppHandle,
    session: &mut StorageSession,
    metadata: &AppData,
    canvases: &[AppData],
) -> Result<(), String> {
    let key = get_database_key(session, true)?;
    let mut connection = open_database(app)?;
    let transaction = connection.transaction().map_err(database_error)?;
    save_split_app_data_in_transaction(&transaction, &key, metadata, canvases)?;
    transaction.commit().map_err(database_error)?;
    Ok(())
}

pub(crate) fn save_app_data_to_database(
    app: &tauri::AppHandle,
    session: &mut StorageSession,
    data: &AppData,
) -> Result<(), String> {
    let data = migrate_app_data(data.clone())?;
    let (metadata, canvases) = split_app_data(&data);
    save_split_app_data_to_database(app, session, &metadata, &canvases)
}

fn hydrate_canvas_content(
    connection: &Connection,
    key: &[u8; 32],
    metadata: &mut AppData,
) -> Result<(), String> {
    let Some(canvases) = metadata
        .get_mut("canvases")
        .and_then(serde_json::Value::as_array_mut)
    else {
        return Ok(());
    };

    for canvas in canvases {
        let id = canvas_id(canvas)
            .filter(|id| !id.is_empty())
            .ok_or_else(|| "Stored canvas metadata is missing an ID".to_string())?
            .to_string();
        let Some(value) = query_app_data_value(connection, &canvas_storage_key(&id))? else {
            return Err(format!("Stored canvas {id} is missing its content row"));
        };
        let content = decrypt_database_value(&value, key)?;
        let content_id = validate_canvas_content_payload(&content)?;
        if content_id != id {
            return Err(format!(
                "Stored canvas content ID {content_id} does not match metadata ID {id}"
            ));
        }
        merge_canvas_content(canvas, &content);
    }
    Ok(())
}

pub(crate) fn load_app_data_from_database(
    app: &tauri::AppHandle,
    session: &mut StorageSession,
) -> Result<Option<AppData>, String> {
    let connection = open_database(app)?;
    if let Some(value) = query_app_data_value(&connection, APP_METADATA_KEY)? {
        let key = get_database_key(session, false)?;
        let metadata = decrypt_database_value(&value, &key)?;
        let needs_migration = metadata
            .get("schemaVersion")
            .and_then(serde_json::Value::as_u64)
            != Some(APP_DATA_SCHEMA_VERSION);
        let mut metadata = migrate_app_data(metadata)?;
        hydrate_canvas_content(&connection, &key, &mut metadata)?;
        validate_app_data_v1(&metadata)?;
        drop(connection);
        if needs_migration {
            save_app_data_to_database(app, session, &metadata)?;
        }
        return Ok(Some(metadata));
    }

    let Some(value) = query_app_data_value(&connection, APP_STATE_KEY)? else {
        return Ok(None);
    };
    let key = get_database_key(session, false)?;
    let data = migrate_app_data(decrypt_database_value(&value, &key)?)?;
    drop(connection);
    save_app_data_to_database(app, session, &data)?;
    Ok(Some(data))
}

#[tauri::command]
pub(crate) fn load_app_data(app: tauri::AppHandle) -> CommandResult<Option<AppData>> {
    command_result(with_storage(&app, |session| {
        load_app_data_from_database(&app, session)
    }))
}

#[tauri::command]
pub(crate) fn save_app_data_incremental(
    app: tauri::AppHandle,
    metadata: AppData,
    canvases: Vec<AppData>,
) -> CommandResult<()> {
    command_result(with_storage(&app, |session| {
        save_split_app_data_to_database(&app, session, &metadata, &canvases)
    }))
}

fn reset_database_files(
    path: &Path,
    backup: &Path,
    delete_credential: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let moved = if path.exists() {
        fs::rename(path, backup)
            .map_err(|error| format!("Could not back up unreadable database: {error}"))?;
        true
    } else {
        false
    };

    if let Err(delete_error) = delete_credential() {
        if moved {
            if let Err(rollback_error) = fs::rename(backup, path) {
                return Err(format!(
                    "{delete_error}; database rollback also failed ({rollback_error}). Backup remains at {}",
                    backup.display()
                ));
            }
        }
        return Err(delete_error);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn reset_local_database(app: tauri::AppHandle) -> CommandResult<()> {
    command_result(with_storage(&app, |session| {
        let path = database_path(&app)?;
        let backup = backup_database_path(&app)?;
        reset_database_files(&path, &backup, delete_keyring_key)?;
        session.database_key = None;
        session.key_creation_blocked = false;
        Ok(())
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::CommandError;
    use serde_json::json;

    fn valid_app_data() -> AppData {
        serde_json::from_str(include_str!("../../examples/app-data-v1.json"))
            .expect("shared AppDataV1 fixture should be valid JSON")
    }

    fn create_test_schema(connection: &Connection) {
        connection
            .execute_batch(
                "CREATE TABLE app_data (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE images (
                    hash TEXT PRIMARY KEY,
                    format TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    bytes BLOB NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .expect("test schema should be created");
    }

    #[test]
    fn split_storage_round_trip_preserves_canvas_content() {
        let data = json!({
            "schemaVersion": 1,
            "activeCanvasId": "one",
            "canvases": [{
                "id": "one",
                "name": "Canvas",
                "containers": [{"id": "container"}],
                "textCards": [{"id": "card"}],
                "textBlocks": [],
                "images": []
            }]
        });
        let (mut metadata, contents) = split_app_data(&data);
        assert_eq!(metadata["canvases"][0]["containers"], json!([]));
        merge_canvas_content(&mut metadata["canvases"][0], &contents[0]);
        assert_eq!(metadata, data);
    }

    #[test]
    fn incremental_save_requires_every_canvas_content_row() {
        let data = valid_app_data();
        let (metadata, contents) = split_app_data(&data);
        let mut connection = Connection::open_in_memory().unwrap();
        create_test_schema(&connection);
        let key = [9_u8; 32];

        {
            let transaction = connection.transaction().unwrap();
            let error = save_split_app_data_in_transaction(&transaction, &key, &metadata, &[])
                .expect_err("new canvas without supplied content must fail");
            assert!(error.contains("no existing or supplied content row"));
        }

        {
            let transaction = connection.transaction().unwrap();
            save_split_app_data_in_transaction(&transaction, &key, &metadata, &contents)
                .expect("full content should save");
            transaction.commit().unwrap();
        }

        {
            let transaction = connection.transaction().unwrap();
            save_split_app_data_in_transaction(&transaction, &key, &metadata, &[])
                .expect("existing content row should permit metadata-only save");
        }
    }

    #[test]
    fn hydration_fails_closed_when_canvas_content_is_missing() {
        let data = valid_app_data();
        let (mut metadata, _) = split_app_data(&data);
        let connection = Connection::open_in_memory().unwrap();
        create_test_schema(&connection);
        connection
            .execute(
                "INSERT INTO images (hash, format, width, height, bytes) VALUES ('orphan', 'webp', 1, 1, X'00')",
                [],
            )
            .unwrap();
        let error = hydrate_canvas_content(&connection, &[4_u8; 32], &mut metadata)
            .expect_err("incomplete split storage must not hydrate partially");
        assert!(error.contains("missing its content row"));
        let image_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))
            .unwrap();
        assert_eq!(image_count, 1, "failed hydration must not collect images");
    }

    #[test]
    fn reset_restores_database_when_keyring_deletion_fails() {
        let unique: String = random_bytes::<8>()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let directory = std::env::temp_dir().join(format!("taskmap-reset-test-{unique}"));
        fs::create_dir_all(&directory).unwrap();
        let database = directory.join("taskmap.sqlite3");
        let backup = directory.join("taskmap-backup.sqlite3");
        fs::write(&database, b"database").unwrap();

        let error = reset_database_files(&database, &backup, || {
            Err("Could not delete database key from keyring".to_string())
        })
        .expect_err("failed key deletion should fail reset");
        assert!(error.contains("keyring"));
        assert!(database.exists());
        assert!(!backup.exists());
        assert_eq!(fs::read(&database).unwrap(), b"database");

        fs::remove_file(&database).unwrap();
        fs::remove_dir(&directory).unwrap();
    }

    #[test]
    fn key_decoding_and_database_errors_keep_stable_codes() {
        let malformed =
            CommandError::from_message(decode_database_key("not base64".to_string()).unwrap_err());
        assert_eq!(
            serde_json::to_value(malformed).unwrap()["code"],
            "decrypt_failed"
        );

        let database = CommandError::from_message(database_error("disk I/O failure"));
        assert_eq!(serde_json::to_value(database).unwrap()["code"], "database");
    }
}
