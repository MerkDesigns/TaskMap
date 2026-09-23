use super::{
    database_window_commands::ensure_database_application,
    phase2_ipc::{deserialize_limited, MAX_SMALL_IPC_BYTES},
};
use crate::{
    phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure},
    session::{database_session::DatabaseSessionState, session_media_transfer::MediaReply},
};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DropNotice {
    tokens: Vec<String>,
    x: f64,
    y: f64,
}

pub(crate) fn capture_drop(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() != "main" || ensure_database_application(window.app_handle()).is_err() {
        return;
    }
    let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position }) = event else {
        return;
    };
    let paths = paths
        .iter()
        .filter(|path| {
            path.extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| {
                    ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"]
                        .contains(&ext.to_ascii_lowercase().as_str())
                })
        })
        .cloned()
        .collect::<Vec<_>>();
    let Ok(tokens) = window
        .state::<DatabaseSessionState>()
        .capture_image_drop(&paths)
    else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    if !tokens.is_empty() {
        let _ = window.emit(
            "taskmap-image-drop",
            DropNotice {
                tokens,
                x: position.x / scale,
                y: position.y / scale,
            },
        );
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    database_id: String,
    session_id: String,
    token: String,
}
#[tauri::command]
pub(crate) async fn app_import_dropped_image(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<MediaReply> {
    ensure_database_application(&app)?;
    let input: Input = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.import_dropped_image(&input.database_id, &input.session_id, &input.token)
    })
    .await
    .map_err(|_| Phase2CommandError::from(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}
