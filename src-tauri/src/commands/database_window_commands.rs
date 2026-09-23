use super::database_command_types::{ChooseDatabasePathInput, DatabasePathMode};
use super::phase2_ipc::{deserialize_limited, MAX_SMALL_IPC_BYTES};
use crate::files::database_path_authorization::{
    AuthorizedDatabasePath, DatabasePathAuthorizationKind, DatabasePathAuthorizationState,
};
use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};
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
) -> Phase2CommandResult<Option<AuthorizedDatabasePath>> {
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
                .map_err(|_| command_error(Phase2Failure::InvalidInput))?;
            authorizations
                .issue(&path, kind, &application_edition(&app))
                .map_err(Phase2CommandError::from)
        })
        .transpose()
}

#[tauri::command]
pub(crate) fn app_list_recent_databases(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
) -> Phase2CommandResult<RecentDatabaseChoices> {
    ensure_database_application(&app)?;
    let edition = application_edition(&app);
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|_| command_error(Phase2Failure::Settings))?;
    let settings = load_recent_settings(&directory, &edition).map_err(Phase2CommandError::from)?;
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
                if let Err(error) = crate::window_state::restore_window_state(&window) {
                    eprintln!("Failed to restore window state: {error}");
                }
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
    window.destroy().map_err(|error| error.to_string())
}

pub(super) fn ensure_session_keeper(app: &tauri::AppHandle) -> Phase2CommandResult<()> {
    ensure_database_application(app)?;
    if app.get_webview_window("phase2-session-keeper").is_none() {
        let window = WebviewWindowBuilder::new(
            app,
            "phase2-session-keeper",
            WebviewUrl::App("phase2-keeper.html".into()),
        )
        .visible(false)
        .skip_taskbar(true)
        .build()
        .map_err(|_| command_error(Phase2Failure::Internal))?;
        crate::windows_session_notifications::install(&window)
            .map_err(|_| command_error(Phase2Failure::Internal))?;
    }
    Ok(())
}

pub(crate) fn destroy_session_keeper(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("phase2-session-keeper") {
        let _ = window.destroy();
    }
}

pub(super) fn ensure_database_application(app: &tauri::AppHandle) -> Phase2CommandResult<()> {
    super::database_edition::validate_application(
        &app.config().identifier,
        cfg!(feature = "ui-lab-development"),
    )
    .map(|_| ())
}

#[cfg(feature = "phase2-development")]
pub(super) fn ensure_phase2_development(app: &tauri::AppHandle) -> Phase2CommandResult<()> {
    ensure_database_application(app)?;
    if app.config().identifier != DEVELOPMENT_IDENTIFIER {
        return Err(command_error(Phase2Failure::PermissionDenied));
    }
    Ok(())
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
pub(crate) fn app_database_edition(app: tauri::AppHandle) -> Phase2CommandResult<String> {
    ensure_database_application(&app)?;
    Ok(application_edition(&app))
}

fn command_error(failure: Phase2Failure) -> Phase2CommandError {
    Phase2CommandError::from(failure)
}
