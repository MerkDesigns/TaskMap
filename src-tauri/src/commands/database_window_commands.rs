use super::database_command_types::{ChooseDatabasePathInput, DatabasePathMode};
use super::ipc_limits::{deserialize_limited, MAX_SMALL_IPC_BYTES};
use crate::error::{CommandError, CommandResult, ServiceFailure};
use crate::files::database_path_authorization::{
    AuthorizedDatabasePath, DatabasePathAuthorizationKind, DatabasePathAuthorizationState,
};
use crate::session::database_session::DatabaseSessionState;
use crate::settings::recent_databases::load as load_recent_settings;
use serde::Serialize;
use tauri::WebviewUrl;
use tauri::{Manager, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

const DEVELOPMENT_IDENTIFIER: &str = "com.merkdesigns.taskmap.dev";
const STABLE_IDENTIFIER: &str = "com.merkdesigns.taskmap";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentDatabaseChoices {
    version: u32,
    edition: String,
    recent_databases: Vec<AuthorizedDatabasePath>,
}

#[tauri::command]
pub(crate) fn app_choose_database_path(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<Option<AuthorizedDatabasePath>> {
    ensure_database_application(&app)?;
    let input: ChooseDatabasePathInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let mode = input.mode;
    let builder = app
        .dialog()
        .file()
        .add_filter("TaskMap database", &["tmapdb"]);
    let selected = match mode {
        DatabasePathMode::Create => builder.set_file_name("taskmap.tmapdb").blocking_save_file(),
        DatabasePathMode::Open => builder.blocking_pick_file(),
        DatabasePathMode::FullBackup => builder
            .set_file_name("taskmap-full-backup.tmapdb")
            .blocking_save_file(),
    };
    let kind = match mode {
        DatabasePathMode::Create => DatabasePathAuthorizationKind::Create,
        DatabasePathMode::Open => DatabasePathAuthorizationKind::Open,
        DatabasePathMode::FullBackup => DatabasePathAuthorizationKind::FullBackup,
    };
    selected
        .map(|path| {
            let path = path
                .into_path()
                .map_err(|_| command_error(ServiceFailure::InvalidInput))?;
            authorizations
                .issue(&path, kind, &application_edition(&app))
                .map_err(CommandError::from)
        })
        .transpose()
}

#[tauri::command]
pub(crate) fn app_list_recent_databases(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
) -> CommandResult<RecentDatabaseChoices> {
    ensure_database_application(&app)?;
    let edition = application_edition(&app);
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|_| command_error(ServiceFailure::Settings))?;
    let settings = load_recent_settings(&directory, &edition).map_err(CommandError::from)?;
    let recent_databases = settings
        .recent_database_paths
        .iter()
        .filter_map(|path| {
            authorizations
                .issue(
                    std::path::Path::new(path),
                    DatabasePathAuthorizationKind::Open,
                    &edition,
                )
                .ok()
        })
        .collect();
    Ok(RecentDatabaseChoices {
        version: settings.version,
        edition,
        recent_databases,
    })
}

pub(crate) fn reopen_main_window(app: &tauri::AppHandle) -> Result<(), tauri::Error> {
    crate::tray::cancel_lock(app);
    let reopened = if let Some(window) = app.get_webview_window("main") {
        window.unminimize()?;
        window.show()?;
        window.set_focus()
    } else {
        let config = app
            .config()
            .app
            .windows
            .first()
            .ok_or(tauri::Error::WindowNotFound)?;
        WebviewWindowBuilder::from_config(app, config)?
            .build()
            .and_then(|window| {
                crate::webview_browser_features::disable_browser_features(&window);
                if let Err(error) = crate::window_state::restore_window_state(&window) {
                    eprintln!("Failed to restore window state: {error}");
                }
                show_main_window_eventually(&window);
                crate::windows_session_notifications::install(&window)
                    .map_err(|message| tauri::Error::Io(std::io::Error::other(message)))
            })
    };
    if reopened.is_err() {
        app.state::<DatabaseSessionState>()
            .handle_window_recreation_failure();
        destroy_session_keeper(app);
        app.exit(1);
    }
    reopened
}

/// The main window starts hidden (and is sized and placed while hidden); the frontend shows it once
/// its first screen has painted. This shows it anyway if that never happens, e.g. after a render
/// failure, so the window can never stay invisible.
pub(crate) fn show_main_window_eventually(window: &tauri::WebviewWindow) {
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if window.is_visible().is_ok_and(|visible| !visible) {
            let _ = window.show();
            let _ = window.set_focus();
        }
    });
}

/// Called only after the frontend has completed its save-before-close guard.
#[tauri::command]
pub(crate) fn app_destroy_main_window(
    app: tauri::AppHandle,
    window: tauri::Window,
) -> Result<(), String> {
    ensure_database_application(&app).map_err(|_| "Unavailable application".to_string())?;
    if window.label() != "main" {
        return Err("Only the main window can close through this command".into());
    }
    // Geometry is best effort and must not trap users in an otherwise safely saved window.
    if let Err(error) = crate::window_state::save_window_state(&window) {
        eprintln!("Failed to save window state: {error}");
    }
    window.destroy().map_err(|error| error.to_string())?;
    // The frontend saved before asking; now the device setting decides between tray and quit.
    let (close_to_tray, tray_lock_minutes) = window_close_policy(&app);
    if !close_to_tray {
        crate::tray::quit_now(&app);
    } else if app.state::<DatabaseSessionState>().has_open_session() {
        crate::tray::arm_lock(&app, tray_lock_minutes);
    }
    Ok(())
}

/// Unreadable preferences fall back to the shipped default: keep running in the tray, no timer.
fn window_close_policy(app: &tauri::AppHandle) -> (bool, u32) {
    app.path()
        .app_config_dir()
        .ok()
        .and_then(|directory| {
            crate::settings::device_preferences::load(&directory, &application_edition(app)).ok()
        })
        .map(|state| {
            (
                state.preferences.close_to_tray,
                state.preferences.tray_lock_minutes,
            )
        })
        .unwrap_or((true, 0))
}

pub(super) fn ensure_session_keeper(app: &tauri::AppHandle) -> CommandResult<()> {
    ensure_database_application(app)?;
    if app.get_webview_window("session-keeper").is_none() {
        let window = WebviewWindowBuilder::new(
            app,
            "session-keeper",
            WebviewUrl::App("session-keeper.html".into()),
        )
        .visible(false)
        .skip_taskbar(true)
        .build()
        .map_err(|_| command_error(ServiceFailure::Internal))?;
        crate::windows_session_notifications::install(&window)
            .map_err(|_| command_error(ServiceFailure::Internal))?;
    }
    Ok(())
}

pub(crate) fn destroy_session_keeper(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("session-keeper") {
        let _ = window.destroy();
    }
}

pub(super) fn ensure_database_application(app: &tauri::AppHandle) -> CommandResult<()> {
    super::database_edition::validate_application(&app.config().identifier).map(|_| ())
}

pub(super) fn application_edition(app: &tauri::AppHandle) -> String {
    if app.config().identifier == DEVELOPMENT_IDENTIFIER {
        "development"
    } else if app.config().identifier == STABLE_IDENTIFIER {
        "stable"
    } else {
        "unknown"
    }
    .to_string()
}

#[tauri::command]
pub(crate) fn app_database_edition(app: tauri::AppHandle) -> CommandResult<String> {
    ensure_database_application(&app)?;
    Ok(application_edition(&app))
}

fn command_error(failure: ServiceFailure) -> CommandError {
    CommandError::from(failure)
}
