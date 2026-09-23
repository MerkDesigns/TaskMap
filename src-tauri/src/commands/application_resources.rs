use super::database_window_commands::{application_edition, ensure_database_application};
use super::phase2_ipc::deserialize_limited;
use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};
use crate::session::{
    database_session::DatabaseSessionState,
    session_media_transfer::{MediaAction, MediaReply},
    SensitiveDocument,
};
use crate::settings::device_preferences::{self, DevicePreferences, PreferencesState};
use serde::Deserialize;
use tauri::Manager;
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MediaInput {
    database_id: String,
    session_id: String,
    operation: MediaAction,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ViewInput {
    database_id: String,
    session_id: String,
    value: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PreferencesInput {
    expected_revision: u64,
    preferences: DevicePreferences,
}

#[tauri::command]
pub(crate) async fn app_media_transfer(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<MediaReply> {
    ensure_database_application(&app)?;
    let input: MediaInput = deserialize_limited(&request, 360 * 1024)?;
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.media_transfer(&input.database_id, &input.session_id, input.operation)
    })
    .await
    .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}
#[tauri::command]
pub(crate) async fn app_view_state(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<Option<SensitiveDocument>> {
    ensure_database_application(&app)?;
    let input: ViewInput = deserialize_limited(&request, 256 * 1024)?;
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|_| Phase2CommandError::from(Phase2Failure::Settings))?;
    let edition = application_edition(&app);
    let service = state.inner().clone();
    let value = input.value.map(Zeroizing::new);
    tauri::async_runtime::spawn_blocking(move || {
        service.view_state(
            &directory,
            &edition,
            &input.database_id,
            &input.session_id,
            value.as_ref().map(|s| s.as_str()),
        )
    })
    .await
    .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}
#[tauri::command]
pub(crate) async fn app_load_preferences(
    app: tauri::AppHandle,
) -> Phase2CommandResult<PreferencesState> {
    ensure_database_application(&app)?;
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|_| Phase2CommandError::from(Phase2Failure::Settings))?;
    let edition = application_edition(&app);
    tauri::async_runtime::spawn_blocking(move || device_preferences::load(&directory, &edition))
        .await
        .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
        .map_err(Phase2CommandError::from)
}
#[tauri::command]
pub(crate) async fn app_save_preferences(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<PreferencesState> {
    ensure_database_application(&app)?;
    let input: PreferencesInput = deserialize_limited(&request, 16 * 1024)?;
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|_| Phase2CommandError::from(Phase2Failure::Settings))?;
    let edition = application_edition(&app);
    tauri::async_runtime::spawn_blocking(move || {
        device_preferences::save(
            &directory,
            &edition,
            input.expected_revision,
            input.preferences,
        )
    })
    .await
    .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}
