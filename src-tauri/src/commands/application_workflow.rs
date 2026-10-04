use super::database_window_commands::ensure_database_application;
use super::ipc_limits::deserialize_limited;
use crate::error::{CommandError, CommandResult, ServiceFailure, ServiceResult};
use crate::session::database_session::DatabaseSessionState;
use crate::workflow::workflow_definition::{self, WorkflowLine};
use crate::workflow::workflow_runs::{RunStatus, WorkflowRuns};
use crate::workflow::workflow_trust::WorkflowTrust;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::Manager;

/// A workflow definition fits well inside this; anything larger is rejected before parsing.
const WORKFLOW_INPUT_LIMIT: usize = 512 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DefinitionInput {
    database_id: String,
    session_id: String,
    lines: Vec<WorkflowLine>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RunInput {
    database_id: String,
    session_id: String,
    run_id: String,
}

fn config_directory(app: &tauri::AppHandle) -> CommandResult<PathBuf> {
    app.path()
        .app_config_dir()
        .map_err(|_| CommandError::from(ServiceFailure::Settings))
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> ServiceResult<T> + Send + 'static,
) -> CommandResult<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| CommandError::from(ServiceFailure::Internal))?
        .map_err(CommandError::from)
}

/// Whether this device trusts the definition for the open database.
#[tauri::command]
pub(crate) async fn app_workflow_trust_state(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<bool> {
    ensure_database_application(&app)?;
    let input: DefinitionInput = deserialize_limited(&request, WORKFLOW_INPUT_LIMIT)?;
    let directory = config_directory(&app)?;
    let (sessions, app) = (sessions.inner().clone(), app.clone());
    blocking(move || {
        sessions.authorize(&input.database_id, &input.session_id)?;
        workflow_definition::validate(&input.lines)?;
        let hash = workflow_definition::definition_hash(&input.lines)?;
        app.state::<WorkflowTrust>()
            .is_trusted(&directory, &input.database_id, &hash)
    })
    .await
}

/// Records the definition as trusted on this device; called for what the user wrote or reviewed.
#[tauri::command]
pub(crate) async fn app_workflow_trust(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<()> {
    ensure_database_application(&app)?;
    let input: DefinitionInput = deserialize_limited(&request, WORKFLOW_INPUT_LIMIT)?;
    let directory = config_directory(&app)?;
    let (sessions, app) = (sessions.inner().clone(), app.clone());
    blocking(move || {
        sessions.authorize(&input.database_id, &input.session_id)?;
        workflow_definition::validate(&input.lines)?;
        let hash = workflow_definition::definition_hash(&input.lines)?;
        app.state::<WorkflowTrust>()
            .record(&directory, &input.database_id, &hash)
    })
    .await
}

/// Starts a trusted definition; an untrusted one is refused below the UI.
#[tauri::command]
pub(crate) async fn app_workflow_run(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<RunStatus> {
    ensure_database_application(&app)?;
    let input: DefinitionInput = deserialize_limited(&request, WORKFLOW_INPUT_LIMIT)?;
    let directory = config_directory(&app)?;
    let (sessions, app) = (sessions.inner().clone(), app.clone());
    blocking(move || {
        sessions.authorize(&input.database_id, &input.session_id)?;
        crate::workflow::run_trusted(
            &app.state::<WorkflowTrust>(),
            &app.state::<WorkflowRuns>(),
            &directory,
            &input.database_id,
            input.lines,
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn app_workflow_status(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<RunStatus> {
    ensure_database_application(&app)?;
    let input: RunInput = deserialize_limited(&request, 4 * 1024)?;
    let (sessions, app) = (sessions.inner().clone(), app.clone());
    blocking(move || {
        sessions.authorize(&input.database_id, &input.session_id)?;
        app.state::<WorkflowRuns>()
            .status(&input.database_id, &input.run_id)
    })
    .await
}

#[tauri::command]
pub(crate) async fn app_workflow_stop(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<RunStatus> {
    ensure_database_application(&app)?;
    let input: RunInput = deserialize_limited(&request, 4 * 1024)?;
    let (sessions, app) = (sessions.inner().clone(), app.clone());
    blocking(move || {
        sessions.authorize(&input.database_id, &input.session_id)?;
        app.state::<WorkflowRuns>()
            .stop(&input.database_id, &input.run_id)
    })
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SessionInput {
    database_id: String,
    session_id: String,
}

/// Lets the user pick a working directory; returns only the folder they chose.
#[tauri::command]
pub(crate) async fn app_workflow_choose_folder(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> CommandResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;
    ensure_database_application(&app)?;
    let input: SessionInput = deserialize_limited(&request, 4 * 1024)?;
    sessions
        .authorize(&input.database_id, &input.session_id)
        .map_err(CommandError::from)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .map(|folder| folder.into_path().map_err(|_| ServiceFailure::InvalidInput))
            .transpose()
            .map(|path| path.map(|path| path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|_| CommandError::from(ServiceFailure::Internal))?
    .map_err(CommandError::from)
}
