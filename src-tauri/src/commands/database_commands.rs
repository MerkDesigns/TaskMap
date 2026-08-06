use super::database_command_types::{
    CancelPendingUnlockInput, ConfirmUnlockInput, CreateDatabaseInput, FullBackupInput,
    OpenDatabaseInput, SaveDocumentInput, UnlockDatabaseInput,
};
use super::database_window_commands::{
    application_edition, destroy_session_keeper, ensure_phase2_development, ensure_session_keeper,
};
use super::phase2_ipc::{deserialize_limited, MAX_DOCUMENT_IPC_BYTES, MAX_SMALL_IPC_BYTES};
use crate::files::database_path_authorization::{
    DatabasePathAuthorizationKind, DatabasePathAuthorizationState,
};
use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};
use crate::session::database_session::DatabaseSessionState;
use crate::session::{
    DatabaseSessionStatus, LoadedDocument, PendingLoadedDocument, SavedDocument, SessionOperation,
    PENDING_UNLOCK_TIMEOUT,
};
use crate::settings::recent_databases::record_recent;
use tauri::Manager;
use zeroize::Zeroizing;

#[tauri::command]
pub(crate) async fn phase2_create_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<PendingLoadedDocument> {
    ensure_phase2_development(&app)?;
    let input: CreateDatabaseInput = deserialize_limited(&request, MAX_DOCUMENT_IPC_BYTES)?;
    let edition = application_edition(&app);
    let path = authorizations
        .redeem(
            &input.authorization_token,
            DatabasePathAuthorizationKind::Create,
            &edition,
        )
        .map_err(Phase2CommandError::from)?;
    let service = state.inner().clone();
    let service_for_cleanup = service.clone();
    let password = Zeroizing::new(input.password);
    let serialized_document = Zeroizing::new(input.serialized_document);
    let database_id = input.database_id;
    let document_schema_version = input.document_schema_version;
    let path_for_recent = path.clone();
    let mut result = tauri::async_runtime::spawn_blocking(move || {
        service.create_database(
            path,
            database_id,
            document_schema_version,
            serialized_document.as_str(),
            password.as_bytes(),
            &edition,
        )
    })
    .await
    .map_err(|_| command_error(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)?;
    if let Err(error) = ensure_session_keeper(&app) {
        let _ = service_for_cleanup.close_database();
        return Err(error);
    }
    if let Some(warning) = record_recent_warning(&app, &path_for_recent) {
        result.warnings.push(warning);
    }
    schedule_pending_timeout(
        app.clone(),
        state.inner().clone(),
        result.confirmation_token.clone(),
    );
    Ok(result)
}

#[tauri::command]
pub(crate) async fn phase2_open_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<SessionOperation> {
    ensure_phase2_development(&app)?;
    let input: OpenDatabaseInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let edition = application_edition(&app);
    let path = authorizations
        .redeem(
            &input.authorization_token,
            DatabasePathAuthorizationKind::Open,
            &edition,
        )
        .map_err(Phase2CommandError::from)?;
    let service = state.inner().clone();
    let service_for_cleanup = service.clone();
    let path_for_recent = path.clone();
    let session =
        tauri::async_runtime::spawn_blocking(move || service.open_database(path, &edition))
            .await
            .map_err(|_| command_error(Phase2Failure::Internal))?
            .map_err(Phase2CommandError::from)?;
    if let Err(error) = ensure_session_keeper(&app) {
        let _ = service_for_cleanup.close_database();
        return Err(error);
    }
    let warnings = record_recent_warning(&app, &path_for_recent)
        .into_iter()
        .collect();
    Ok(SessionOperation { session, warnings })
}

#[tauri::command]
pub(crate) async fn phase2_unlock_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<PendingLoadedDocument> {
    ensure_phase2_development(&app)?;
    let input: UnlockDatabaseInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let service = state.inner().clone();
    let password = Zeroizing::new(input.password);
    let result =
        tauri::async_runtime::spawn_blocking(move || service.unlock_database(password.as_bytes()))
            .await
            .map_err(|_| command_error(Phase2Failure::Internal))?
            .map_err(Phase2CommandError::from)?;
    schedule_pending_timeout(
        app.clone(),
        state.inner().clone(),
        result.confirmation_token.clone(),
    );
    Ok(result)
}

#[tauri::command]
pub(crate) fn phase2_confirm_unlock(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    let input: ConfirmUnlockInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    if input.database_purpose != "development" {
        let _ = state.cancel_pending_unlock(&input.confirmation_token);
        destroy_session_keeper(&app);
        return Err(command_error(Phase2Failure::DatabasePurposeMismatch));
    }
    match state.confirm_unlock(&input.confirmation_token, &input.database_id) {
        Ok(status) => Ok(status),
        Err(error) => {
            destroy_session_keeper(&app);
            Err(Phase2CommandError::from(error))
        }
    }
}

#[tauri::command]
pub(crate) fn phase2_cancel_pending_unlock(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    let input: CancelPendingUnlockInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let result = state
        .cancel_pending_unlock(&input.confirmation_token)
        .map_err(Phase2CommandError::from);
    destroy_session_keeper(&app);
    result
}

#[tauri::command]
pub(crate) async fn phase2_read_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<LoadedDocument> {
    ensure_phase2_development(&app)?;
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.read_document())
        .await
        .map_err(|_| command_error(Phase2Failure::Internal))?
        .map_err(Phase2CommandError::from)
}

#[tauri::command]
pub(crate) async fn phase2_save_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<SavedDocument> {
    ensure_phase2_development(&app)?;
    let input: SaveDocumentInput = deserialize_limited(&request, MAX_DOCUMENT_IPC_BYTES)?;
    if input.database_purpose != "development" {
        return Err(command_error(Phase2Failure::DatabasePurposeMismatch));
    }
    let status = state.get_status().map_err(Phase2CommandError::from)?;
    if status.database_id.as_deref() != Some(&input.database_id) {
        return Err(command_error(Phase2Failure::InvalidDocumentPayload));
    }
    let service = state.inner().clone();
    let serialized_document = Zeroizing::new(input.serialized_document);
    let expected_revision = input.expected_revision;
    tauri::async_runtime::spawn_blocking(move || {
        service.save_document(serialized_document.as_str(), expected_revision)
    })
    .await
    .map_err(|_| command_error(Phase2Failure::Internal))?
    .map_err(Phase2CommandError::from)
}

#[tauri::command]
pub(crate) async fn phase2_full_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<()> {
    ensure_phase2_development(&app)?;
    let input: FullBackupInput = deserialize_limited(&request, MAX_SMALL_IPC_BYTES)?;
    let destination = authorizations
        .redeem(
            &input.authorization_token,
            DatabasePathAuthorizationKind::FullBackup,
            &application_edition(&app),
        )
        .map_err(Phase2CommandError::from)?;
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.full_backup(&destination))
        .await
        .map_err(|_| command_error(Phase2Failure::Internal))?
        .map_err(Phase2CommandError::from)
}

#[tauri::command]
pub(crate) fn phase2_lock_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    let status = state.lock_database().map_err(Phase2CommandError::from)?;
    destroy_session_keeper(&app);
    Ok(status)
}

#[tauri::command]
pub(crate) fn phase2_close_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    let status = state.close_database().map_err(Phase2CommandError::from)?;
    destroy_session_keeper(&app);
    Ok(status)
}

#[tauri::command]
pub(crate) fn phase2_quit_application(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<()> {
    ensure_phase2_development(&app)?;
    state.quit_session().map_err(Phase2CommandError::from)?;
    destroy_session_keeper(&app);
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub(crate) fn phase2_get_session_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    state.get_status().map_err(Phase2CommandError::from)
}

fn schedule_pending_timeout(
    app: tauri::AppHandle,
    service: DatabaseSessionState,
    confirmation_token: String,
) {
    std::thread::spawn(move || {
        std::thread::sleep(PENDING_UNLOCK_TIMEOUT);
        if service.expire_pending_unlock(&confirmation_token) {
            destroy_session_keeper(&app);
        }
    });
}

fn record_recent_warning(app: &tauri::AppHandle, path: &std::path::Path) -> Option<String> {
    let edition = application_edition(app);
    let result = app
        .path()
        .app_config_dir()
        .map_err(|_| Phase2Failure::Settings)
        .and_then(|directory| record_recent(&directory, &edition, path).map(|_| ()));
    result
        .err()
        .map(|_| "The database opened, but its recent-list entry could not be saved.".to_string())
}

fn command_error(failure: Phase2Failure) -> Phase2CommandError {
    Phase2CommandError::from(failure)
}
