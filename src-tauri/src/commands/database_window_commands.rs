#[cfg(feature = "phase2-development")]
use super::database_command_types::{ChooseDatabasePathInput, DatabasePathMode};
#[cfg(feature = "phase2-development")]
use super::phase2_ipc::{deserialize_limited, MAX_SMALL_IPC_BYTES};
#[cfg(feature = "phase2-development")]
use crate::files::database_path_authorization::{
    AuthorizedDatabasePath, DatabasePathAuthorizationKind, DatabasePathAuthorizationState,
};
#[cfg(feature = "phase2-development")]
use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};
use crate::session::database_session::DatabaseSessionState;
#[cfg(feature = "phase2-development")]
use crate::settings::recent_databases::load as load_recent_settings;
#[cfg(feature = "phase2-development")]
use serde::Serialize;
#[cfg(feature = "phase2-development")]
use tauri::WebviewUrl;
use tauri::{Manager, WebviewWindowBuilder};
#[cfg(feature = "phase2-development")]
use tauri_plugin_dialog::DialogExt;

#[cfg(feature = "phase2-development")]
const DEVELOPMENT_IDENTIFIER: &str = "com.merkdesigns.taskmap.dev";
#[cfg(feature = "phase2-development")]
const STABLE_IDENTIFIER: &str = "com.merkdesigns.taskmap";

#[cfg(feature = "phase2-development")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentDatabaseChoices {
    version: u32,
    edition: String,
    recent_databases: Vec<AuthorizedDatabasePath>,
}

#[tauri::command]
#[cfg(feature = "phase2-development")]
pub(crate) fn phase2_choose_database_path(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<Option<AuthorizedDatabasePath>> {
    ensure_phase2_development(&app)?;
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
#[cfg(feature = "phase2-development")]
pub(crate) fn phase2_list_recent_databases(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
) -> Phase2CommandResult<RecentDatabaseChoices> {
    ensure_phase2_development(&app)?;
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
            .map(|_| ())
    };
    if reopened.is_err() {
        app.state::<DatabaseSessionState>()
            .handle_window_recreation_failure();
        destroy_session_keeper(app);
        app.exit(1);
    }
    reopened
}

#[cfg(feature = "phase2-development")]
pub(super) fn ensure_session_keeper(app: &tauri::AppHandle) -> Phase2CommandResult<()> {
    ensure_phase2_development(app)?;
    if app.get_webview_window("phase2-session-keeper").is_none() {
        WebviewWindowBuilder::new(
            app,
            "phase2-session-keeper",
            WebviewUrl::App("phase2-keeper.html".into()),
        )
        .visible(false)
        .skip_taskbar(true)
        .build()
        .map_err(|_| command_error(Phase2Failure::Internal))?;
    }
    Ok(())
}

pub(crate) fn destroy_session_keeper(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("phase2-session-keeper") {
        let _ = window.destroy();
    }
}

#[cfg(feature = "phase2-development")]
pub(super) fn ensure_phase2_development(app: &tauri::AppHandle) -> Phase2CommandResult<()> {
    if cfg!(feature = "phase2-development") && app.config().identifier == DEVELOPMENT_IDENTIFIER {
        Ok(())
    } else {
        Err(command_error(Phase2Failure::PermissionDenied))
    }
}

#[cfg(feature = "phase2-development")]
pub(super) fn application_edition(app: &tauri::AppHandle) -> String {
    if app.config().identifier == DEVELOPMENT_IDENTIFIER {
        "development".to_string()
    } else if app.config().identifier == STABLE_IDENTIFIER {
        "stable".to_string()
    } else {
        "unknown".to_string()
    }
}

#[cfg(feature = "phase2-development")]
fn command_error(failure: Phase2Failure) -> Phase2CommandError {
    Phase2CommandError::from(failure)
}
