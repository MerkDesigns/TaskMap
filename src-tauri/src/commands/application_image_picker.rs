use super::database_window_commands::ensure_database_application;
use super::phase2_ipc::{deserialize_limited, MAX_SMALL_IPC_BYTES};
use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};
use crate::session::{database_session::DatabaseSessionState, session_media_transfer::MediaReply};
use serde::Deserialize;
use tauri_plugin_dialog::DialogExt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    database_id: String,
    session_id: String,
}

#[tauri::command]
pub(crate) async fn app_choose_image(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<Option<MediaReply>> {
    ensure_database_application(&app)?;
    let input: Input = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    state
        .authorize_media(&input.database_id, &input.session_id)
        .map_err(Phase2CommandError::from)?;
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter(
                "Images",
                &["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"],
            )
            .blocking_pick_file();
        let Some(selected) = selected else {
            return Ok(None);
        };
        let path = selected
            .into_path()
            .map_err(|_| Phase2Failure::InvalidInput)?;
        service
            .import_media_file(&input.database_id, &input.session_id, &path)
            .map(Some)
    })
    .await
    .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}
