#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use discord_rich_presence::activity::{Activity, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use image::imageops::FilterType;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, PhysicalPosition, PhysicalSize};
use tauri_plugin_dialog::DialogExt;

const APP_STATE_KEY: &str = "app_state";
const KEYRING_SERVICE: &str = "TaskMap";
const KEYRING_USER: &str = "app-data-key";
const EXPORT_VERSION: u8 = 1;
const EXPORT_KDF_ITERATIONS: u32 = 210_000;
const DISCORD_CLIENT_ID: &str = "1513214503297486898";
/// Longest edge (px) a raster image is downscaled to on import. Matches the
/// canvas size so nothing loses detail at full zoom.
const IMAGE_MAX_EDGE: u32 = 2560;
/// WebP quality (0-100) for lossy re-encoding of raster images.
const IMAGE_WEBP_QUALITY: f32 = 80.0;

type AppData = serde_json::Value;

/// Holds the live Discord IPC connection. `None` when RPC is disabled or
/// Discord is not running. The session start time is fixed for the whole
/// app run so the presence shows total time spent in the application.
///
/// `desired` is the last enabled/disabled state the UI asked for. A single
/// mutex serializes reconciliation so that rapid toggling collapses into one
/// connection change instead of thrashing the (fragile) IPC pipe.
struct DiscordRpc {
    inner: Mutex<DiscordRpcInner>,
    started_at: i64,
}

struct DiscordRpcInner {
    client: Option<DiscordIpcClient>,
    desired: bool,
    canvas_name: Option<String>,
}

impl DiscordRpc {
    fn new(started_at: i64) -> Self {
        Self {
            inner: Mutex::new(DiscordRpcInner {
                client: None,
                desired: false,
                canvas_name: None,
            }),
            started_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EncryptedPayload {
    version: u8,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExportPayload {
    version: u8,
    kdf: String,
    iterations: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
}

/// Metadata returned to the frontend after an image is stored. The frontend
/// keeps only this on the element; the bytes stay in the `images` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ImageMeta {
    hash: String,
    format: String,
    width: u32,
    height: u32,
}

/// A full image (meta + raw bytes) used only when bundling into / restoring
/// from an encrypted export. Never part of `app_data`.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundledImage {
    hash: String,
    format: String,
    width: u32,
    height: u32,
    data: String, // base64 of the raw (decoded) image bytes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    Ok(data_dir.join("taskmap.sqlite3"))
}

fn backup_database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    Ok(data_dir.join(format!("taskmap-unreadable-{timestamp}.sqlite3")))
}

fn window_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    Ok(data_dir.join("window-state.json"))
}

fn load_window_state(app: &tauri::AppHandle) -> Result<Option<WindowState>, String> {
    let path = window_state_path(app)?;
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents)
            .map(Some)
            .map_err(|error| format!("Stored window state is invalid: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read window state: {error}")),
    }
}

fn restore_window_state(window: &tauri::WebviewWindow) -> Result<(), String> {
    let Some(state) = load_window_state(window.app_handle())? else {
        return Ok(());
    };

    if state.maximized {
        window.maximize().map_err(|error| error.to_string())?;
        return Ok(());
    }

    // Clamp the saved geometry so the window can never restore off-screen or
    // smaller than usable — e.g. when it was last closed on a monitor that is
    // no longer connected, or with a degenerate size.
    let (mut x, mut y, mut width, mut height) =
        (state.x, state.y, state.width, state.height);

    const MIN_WIDTH: u32 = 640;
    const MIN_HEIGHT: u32 = 480;
    width = width.max(MIN_WIDTH);
    height = height.max(MIN_HEIGHT);

    // Find a monitor whose area contains the window's top-left corner; if none
    // does (the saved screen is gone), fall back to the primary monitor.
    let monitors = window.available_monitors().unwrap_or_default();
    let contains = |m: &tauri::window::Monitor| {
        let pos = m.position();
        let size = m.size();
        x >= pos.x
            && y >= pos.y
            && x < pos.x + size.width as i32
            && y < pos.y + size.height as i32
    };
    let target = monitors
        .iter()
        .find(|m| contains(m))
        .cloned()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(monitor) = target {
        let mpos = monitor.position();
        let msize = monitor.size();
        // Keep the window no larger than the monitor.
        width = width.min(msize.width);
        height = height.min(msize.height);
        // Keep the window fully inside the monitor.
        let max_x = mpos.x + msize.width as i32 - width as i32;
        let max_y = mpos.y + msize.height as i32 - height as i32;
        x = x.clamp(mpos.x, max_x.max(mpos.x));
        y = y.clamp(mpos.y, max_y.max(mpos.y));
    }

    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn save_window_state(window: &tauri::Window) -> Result<(), String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: window.is_maximized().map_err(|error| error.to_string())?,
    };
    let payload = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;

    fs::write(window_state_path(window.app_handle())?, payload)
        .map_err(|error| format!("Could not save window state: {error}"))
}

fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute(
            "CREATE TABLE IF NOT EXISTS app_data (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|error| error.to_string())?;
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
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0_u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

fn decode_database_key(encoded: String) -> Result<[u8; 32], String> {
    let decoded = BASE64
        .decode(encoded.trim())
        .map_err(|error| format!("Stored database key is invalid: {error}"))?;
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
        Err(error) => Err(format!("Could not delete database key from keyring: {error}")),
    }
}

fn get_database_key(create: bool) -> Result<[u8; 32], String> {
    let entry = keyring_entry()?;

    match entry.get_password() {
        Ok(password) => decode_database_key(password),
        Err(keyring::Error::NoEntry) if create => {
            let key = random_bytes::<32>();
            entry
                .set_password(&BASE64.encode(key))
                .map_err(|error| format!("Could not save generated database key: {error}"))?;
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => Err(
            "Encrypted app data exists, but no database key was found in the system keyring."
                .to_string(),
        ),
        Err(error) => Err(format!("Could not read database key: {error}")),
    }
}

fn encrypt_with_key(plaintext: &[u8], key: &[u8; 32]) -> Result<EncryptedPayload, String> {
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

fn decrypt_with_key(payload: &EncryptedPayload, key: &[u8; 32]) -> Result<Vec<u8>, String> {
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

fn derive_export_key(password: &str, salt: &[u8], iterations: u32) -> Result<[u8; 32], String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }

    let mut key = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
    Ok(key)
}

/// The decrypted body of an export. Images are bundled so the file is portable
/// across machines. Old exports were the bare `AppData` JSON; `from_plaintext`
/// handles both shapes.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExportBody {
    data: AppData,
    #[serde(default)]
    images: Vec<BundledImage>,
}

impl ExportBody {
    fn from_plaintext(plaintext: &[u8]) -> Result<Self, String> {
        if let Ok(body) = serde_json::from_slice::<ExportBody>(plaintext) {
            return Ok(body);
        }
        // Backward compatibility: an export written before image bundling is the
        // bare AppData value.
        let data: AppData = serde_json::from_slice(plaintext)
            .map_err(|error| format!("Export data is invalid: {error}"))?;
        Ok(ExportBody {
            data,
            images: Vec::new(),
        })
    }
}

fn encrypt_export(
    data: &AppData,
    images: &[BundledImage],
    password: &str,
) -> Result<String, String> {
    let salt = random_bytes::<16>();
    let key = derive_export_key(password, &salt, EXPORT_KDF_ITERATIONS)?;
    let body = ExportBody {
        data: data.clone(),
        images: images.to_vec(),
    };
    let encrypted = encrypt_with_key(
        serde_json::to_string(&body)
            .map_err(|error| error.to_string())?
            .as_bytes(),
        &key,
    )?;

    let payload = ExportPayload {
        version: EXPORT_VERSION,
        kdf: "pbkdf2-sha256".to_string(),
        iterations: EXPORT_KDF_ITERATIONS,
        salt: BASE64.encode(salt),
        nonce: encrypted.nonce,
        ciphertext: encrypted.ciphertext,
    };

    serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())
}

fn decrypt_export(payload: &str, password: &str) -> Result<(AppData, Vec<BundledImage>), String> {
    let export: ExportPayload =
        serde_json::from_str(payload).map_err(|error| format!("Export file is invalid: {error}"))?;

    if export.version != EXPORT_VERSION || export.kdf != "pbkdf2-sha256" {
        return Err("Unsupported export file format".to_string());
    }

    let salt = BASE64
        .decode(export.salt)
        .map_err(|error| format!("Export salt is invalid: {error}"))?;
    let key = derive_export_key(password, &salt, export.iterations)?;
    let plaintext = decrypt_with_key(
        &EncryptedPayload {
            version: 1,
            nonce: export.nonce,
            ciphertext: export.ciphertext,
        },
        &key,
    )?;

    let body = ExportBody::from_plaintext(&plaintext)?;
    Ok((body.data, body.images))
}

/// Walk arbitrary AppData JSON and collect every string value under an
/// `"imageId"` key. Keeps export bundling decoupled from the exact canvas shape.
fn collect_image_ids(value: &serde_json::Value, out: &mut HashSet<String>) {
    match value {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                if k == "imageId" {
                    if let serde_json::Value::String(hash) = v {
                        out.insert(hash.clone());
                    }
                }
                collect_image_ids(v, out);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                collect_image_ids(item, out);
            }
        }
        _ => {}
    }
}

fn save_app_data_to_database(app: &tauri::AppHandle, data: &AppData) -> Result<(), String> {
    let connection = open_database(app)?;
    let key = get_database_key(true)?;
    let plaintext = serde_json::to_string(data).map_err(|error| error.to_string())?;
    let encrypted = encrypt_with_key(plaintext.as_bytes(), &key)?;
    let value = serde_json::to_string(&encrypted).map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO app_data (key, value, updated_at)
             VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP",
            params![APP_STATE_KEY, value],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle) -> Result<Option<AppData>, String> {
    let connection = open_database(&app)?;
    let value: Option<String> = connection
        .query_row(
            "SELECT value FROM app_data WHERE key = ?1",
            [APP_STATE_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(value) = value else {
        return Ok(None);
    };

    let encrypted: EncryptedPayload =
        serde_json::from_str(&value).map_err(|error| format!("Stored app data is invalid: {error}"))?;
    let key = get_database_key(false)?;
    let plaintext = decrypt_with_key(&encrypted, &key)?;

    serde_json::from_slice(&plaintext)
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, data: AppData) -> Result<(), String> {
    save_app_data_to_database(&app, &data)
}

#[tauri::command]
fn export_app_data(app: tauri::AppHandle, data: AppData, password: String) -> Result<String, String> {
    let mut hashes = HashSet::new();
    collect_image_ids(&data, &mut hashes);

    let mut images = Vec::new();
    if !hashes.is_empty() {
        let connection = open_database(&app)?;
        let key = get_database_key(false)?;
        for hash in &hashes {
            if let Some(meta) = image_meta_by_hash(&connection, hash)? {
                let bytes = read_image_bytes(&connection, &key, hash)?;
                images.push(BundledImage {
                    hash: meta.hash,
                    format: meta.format,
                    width: meta.width,
                    height: meta.height,
                    data: BASE64.encode(bytes),
                });
            }
        }
    }

    encrypt_export(&data, &images, &password)
}

#[tauri::command]
fn import_app_data(app: tauri::AppHandle, payload: String, password: String) -> Result<AppData, String> {
    let (data, images) = decrypt_export(&payload, &password)?;
    let connection = open_database(&app)?;
    let key = get_database_key(true)?;
    for image in &images {
        restore_bundled_image(&connection, &key, image)?;
    }
    save_app_data_to_database(&app, &data)?;
    Ok(data)
}

/// Whether the bytes look like an SVG document (vector — kept as-is, never
/// rasterized) by sniffing the leading non-whitespace.
fn looks_like_svg(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(512)];
    let text = String::from_utf8_lossy(head);
    let trimmed = text.trim_start();
    trimmed.starts_with("<svg") || (trimmed.starts_with("<?xml") && text.contains("<svg"))
}

/// Normalize an incoming image into the bytes we actually persist.
/// - SVG: kept verbatim (dimensions reported as 0, frontend reads natural size).
/// - GIF: kept verbatim to preserve animation (skip downscale/re-encode).
/// - Everything else: decoded, downscaled to `IMAGE_MAX_EDGE`, re-encoded WebP.
fn normalize_image(bytes: &[u8]) -> Result<(String, Vec<u8>, u32, u32), String> {
    if looks_like_svg(bytes) {
        return Ok(("svg".to_string(), bytes.to_vec(), 0, 0));
    }

    let format = image::guess_format(bytes)
        .map_err(|error| format!("Unsupported image data: {error}"))?;

    if format == image::ImageFormat::Gif {
        let dimensions = image::load_from_memory(bytes)
            .map(|decoded| (decoded.width(), decoded.height()))
            .unwrap_or((0, 0));
        return Ok(("gif".to_string(), bytes.to_vec(), dimensions.0, dimensions.1));
    }

    let decoded = image::load_from_memory(bytes)
        .map_err(|error| format!("Could not decode image: {error}"))?;

    let (width, height) = (decoded.width(), decoded.height());
    let scaled = if width.max(height) > IMAGE_MAX_EDGE {
        decoded.resize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, FilterType::Lanczos3)
    } else {
        decoded
    };

    let rgba = scaled.to_rgba8();
    let (out_width, out_height) = (rgba.width(), rgba.height());
    let encoder = webp::Encoder::from_rgba(&rgba, out_width, out_height);
    let encoded = encoder.encode(IMAGE_WEBP_QUALITY);

    Ok(("webp".to_string(), encoded.to_vec(), out_width, out_height))
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Look up an existing image row's metadata by hash, if present.
fn image_meta_by_hash(connection: &Connection, hash: &str) -> Result<Option<ImageMeta>, String> {
    connection
        .query_row(
            "SELECT format, width, height FROM images WHERE hash = ?1",
            [hash],
            |row| {
                Ok(ImageMeta {
                    hash: hash.to_string(),
                    format: row.get(0)?,
                    width: row.get::<_, i64>(1)? as u32,
                    height: row.get::<_, i64>(2)? as u32,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

/// Insert normalized image bytes content-addressed by hash, encrypting the
/// bytes with the database key. Returns metadata. Idempotent: an existing hash
/// is reused (free dedup).
fn store_normalized_image(
    connection: &Connection,
    key: &[u8; 32],
    format: &str,
    bytes: &[u8],
    width: u32,
    height: u32,
) -> Result<ImageMeta, String> {
    let hash = hash_bytes(bytes);

    if let Some(existing) = image_meta_by_hash(connection, &hash)? {
        return Ok(existing);
    }

    let encrypted = encrypt_with_key(bytes, key)?;
    let stored = serde_json::to_vec(&encrypted).map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO images (hash, format, width, height, bytes)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(hash) DO NOTHING",
            params![hash, format, width as i64, height as i64, stored],
        )
        .map_err(|error| error.to_string())?;

    Ok(ImageMeta {
        hash,
        format: format.to_string(),
        width,
        height,
    })
}

/// Fetch and decrypt the raw bytes for a stored image hash.
fn read_image_bytes(connection: &Connection, key: &[u8; 32], hash: &str) -> Result<Vec<u8>, String> {
    let stored: Vec<u8> = connection
        .query_row("SELECT bytes FROM images WHERE hash = ?1", [hash], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Image not found".to_string())?;

    let encrypted: EncryptedPayload =
        serde_json::from_slice(&stored).map_err(|error| format!("Stored image is invalid: {error}"))?;
    decrypt_with_key(&encrypted, key)
}

fn restore_bundled_image(
    connection: &Connection,
    key: &[u8; 32],
    image: &BundledImage,
) -> Result<(), String> {
    let bytes = BASE64
        .decode(&image.data)
        .map_err(|error| format!("Bundled image is invalid: {error}"))?;
    store_normalized_image(
        connection,
        key,
        &image.format,
        &bytes,
        image.width,
        image.height,
    )?;
    Ok(())
}

fn store_image_bytes(app: &tauri::AppHandle, bytes: &[u8]) -> Result<ImageMeta, String> {
    let (format, normalized, width, height) = normalize_image(bytes)?;
    let connection = open_database(app)?;
    let key = get_database_key(true)?;
    store_normalized_image(&connection, &key, &format, &normalized, width, height)
}

/// Store an image whose raw bytes are passed from the frontend as base64.
/// Runs on a blocking thread so a large image's decode/resize/encode never
/// stalls the UI event loop.
#[tauri::command]
async fn store_image(app: tauri::AppHandle, data: String) -> Result<ImageMeta, String> {
    let bytes = BASE64
        .decode(data.trim())
        .map_err(|error| format!("Image data is invalid: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || store_image_bytes(&app, &bytes))
        .await
        .map_err(|error| format!("Image processing failed: {error}"))?
}

/// Return a stored image's raw bytes as base64 for the frontend to turn into a
/// Blob / object URL.
#[tauri::command]
fn load_image(app: tauri::AppHandle, hash: String) -> Result<String, String> {
    let connection = open_database(&app)?;
    let key = get_database_key(false)?;
    let bytes = read_image_bytes(&connection, &key, &hash)?;
    Ok(BASE64.encode(bytes))
}

/// Open a native file picker and return the chosen image path (no processing),
/// so the frontend can show a loading placeholder before the heavier decode.
#[tauri::command]
fn pick_image_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"])
        .blocking_pick_file();

    match path {
        Some(path) => Ok(Some(
            path.into_path()
                .map_err(|error| format!("Could not resolve selected file: {error}"))?
                .to_string_lossy()
                .into_owned(),
        )),
        None => Ok(None),
    }
}

/// Store an image read from a path on disk (used for OS file drops and the
/// picker). Runs on a blocking thread to keep the UI responsive.
#[tauri::command]
async fn store_image_path(app: tauri::AppHandle, path: String) -> Result<ImageMeta, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = fs::read(&path).map_err(|error| format!("Could not read file: {error}"))?;
        store_image_bytes(&app, &bytes)
    })
    .await
    .map_err(|error| format!("Image processing failed: {error}"))?
}

/// Delete every stored image whose hash is not in `used`. Called after saves so
/// orphaned blobs (deleted elements, undone pastes) do not accumulate.
#[tauri::command]
fn gc_images(app: tauri::AppHandle, used: Vec<String>) -> Result<(), String> {
    let connection = open_database(&app)?;
    let used: HashSet<String> = used.into_iter().collect();

    let hashes: Vec<String> = {
        let mut statement = connection
            .prepare("SELECT hash FROM images")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    for hash in hashes {
        if !used.contains(&hash) {
            connection
                .execute("DELETE FROM images WHERE hash = ?1", [&hash])
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
fn reset_local_database(app: tauri::AppHandle) -> Result<(), String> {
    let path = database_path(&app)?;

    if path.exists() {
        fs::rename(&path, backup_database_path(&app)?)
            .map_err(|error| format!("Could not back up unreadable database: {error}"))?;
    }

    delete_keyring_key()?;
    Ok(())
}

/// Enable or disable Discord Rich Presence. When enabled, the presence shows
/// only the elapsed time since the app started — no other information.
/// Connecting is best-effort: if Discord is not running the call still
/// succeeds so the app keeps working.
///
/// This is hardened against rapid toggling: a single mutex guards the whole
/// reconcile, and every call to the (panic-prone) IPC crate is wrapped in
/// `catch_unwind` so a broken pipe degrades to "RPC off" instead of crashing
/// the app. Any failure drops the client so the next enable reconnects clean.
#[tauri::command]
fn set_discord_rpc(
    enabled: bool,
    canvas_name: Option<String>,
    rpc: tauri::State<'_, DiscordRpc>,
) -> Result<(), String> {
    let mut inner = match rpc.inner.lock() {
        Ok(guard) => guard,
        // A previous call panicked while holding the lock. Recover the state
        // and carry on rather than propagating the poison (and crashing).
        Err(poisoned) => poisoned.into_inner(),
    };

    inner.desired = enabled;
    inner.canvas_name = canvas_name;

    if !enabled {
        if let Some(mut client) = inner.client.take() {
            let _ = catch_ipc(move || {
                let _ = client.clear_activity();
                let _ = client.close();
            });
        }
        return Ok(());
    }

    if inner.client.is_none() {
        let connected = catch_ipc(|| {
            let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
            client.connect().map_err(|error| error.to_string())?;
            Ok::<_, String>(client)
        });

        match connected {
            // `Ok(Ok(client))`: connected cleanly.
            Ok(Ok(client)) => inner.client = Some(client),
            // Discord not running / unreachable, or the IPC layer panicked.
            // Leave RPC off silently so the app keeps working.
            Ok(Err(_)) | Err(_) => return Ok(()),
        }
    }

    if let Some(mut client) = inner.client.take() {
        let started_at = rpc.started_at;
        let details = inner
            .canvas_name
            .as_deref()
            .filter(|name| !name.trim().is_empty())
            .map(|name| format!("Working on {name}"));
        let result = catch_ipc(move || {
            let mut activity =
                Activity::new().timestamps(Timestamps::new().start(started_at));
            if let Some(details) = details.as_deref() {
                activity = activity.details(details);
            }
            client.set_activity(activity).map_err(|error| error.to_string())?;
            Ok::<_, String>(client)
        });

        match result {
            Ok(Ok(client)) => inner.client = Some(client),
            // set_activity failed or panicked: drop the client. The next
            // enable will reconnect from scratch instead of reusing a pipe
            // that's in a bad state.
            Ok(Err(_)) | Err(_) => inner.client = None,
        }
    }

    Ok(())
}

/// Run a closure that touches the Discord IPC crate, converting any panic
/// (the crate can panic on a half-open pipe) into an `Err` so the caller
/// stays alive. Returns `Err(())` on panic, otherwise the closure's value.
fn catch_ipc<T>(f: impl FnOnce() -> T) -> Result<T, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).map_err(|_| ())
}

fn main() {
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0);

    tauri::Builder::default()
        .manage(DiscordRpc::new(started_at))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = restore_window_state(&window) {
                    eprintln!("Failed to restore window state: {error}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Err(error) = save_window_state(window) {
                    eprintln!("Failed to save window state: {error}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_app_data,
            save_app_data,
            export_app_data,
            import_app_data,
            reset_local_database,
            store_image,
            load_image,
            store_image_path,
            pick_image_path,
            gc_images,
            set_discord_rpc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
