#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use discord_rich_presence::activity::{Activity, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, PhysicalPosition, PhysicalSize};

const APP_STATE_KEY: &str = "app_state";
const KEYRING_SERVICE: &str = "TaskMap";
const KEYRING_USER: &str = "app-data-key";
const EXPORT_VERSION: u8 = 1;
const EXPORT_KDF_ITERATIONS: u32 = 210_000;
const DISCORD_CLIENT_ID: &str = "1513214503297486898";

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

fn encrypt_export(data: &AppData, password: &str) -> Result<String, String> {
    let salt = random_bytes::<16>();
    let key = derive_export_key(password, &salt, EXPORT_KDF_ITERATIONS)?;
    let encrypted = encrypt_with_key(
        serde_json::to_string(data)
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

fn decrypt_export(payload: &str, password: &str) -> Result<AppData, String> {
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

    serde_json::from_slice(&plaintext).map_err(|error| format!("Export data is invalid: {error}"))
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
fn export_app_data(data: AppData, password: String) -> Result<String, String> {
    encrypt_export(&data, &password)
}

#[tauri::command]
fn import_app_data(app: tauri::AppHandle, payload: String, password: String) -> Result<AppData, String> {
    let data = decrypt_export(&payload, &password)?;
    save_app_data_to_database(&app, &data)?;
    Ok(data)
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
            set_discord_rpc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
