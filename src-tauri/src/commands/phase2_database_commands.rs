// Development harness aliases only; application handlers own the bounded IPC implementation.
use super::database_window_commands::{ensure_phase2_development, RecentDatabaseChoices};
use super::{database_commands, database_window_commands};
use crate::files::database_path_authorization::{
    AuthorizedDatabasePath, DatabasePathAuthorizationState,
};
use crate::phase2_error::Phase2CommandResult;
use crate::session::database_session::DatabaseSessionState;
use crate::session::{
    DatabaseSessionStatus, LoadedDocument, PendingLoadedDocument, SavedDocument, SessionOperation,
};

#[tauri::command]
pub(crate) async fn phase2_create_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<PendingLoadedDocument> {
    ensure_phase2_development(&app)?;
    database_commands::app_create_database(app, state, authorizations, request).await
}

#[tauri::command]
pub(crate) async fn phase2_open_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<SessionOperation> {
    ensure_phase2_development(&app)?;
    database_commands::app_open_database(app, state, authorizations, request).await
}

#[tauri::command]
pub(crate) async fn phase2_unlock_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<PendingLoadedDocument> {
    ensure_phase2_development(&app)?;
    database_commands::app_unlock_database(app, state, request).await
}

#[tauri::command]
pub(crate) fn phase2_confirm_unlock(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    database_commands::app_confirm_unlock(app, state, request)
}

#[tauri::command]
pub(crate) fn phase2_cancel_pending_unlock(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    database_commands::app_cancel_pending_unlock(app, state, request)
}

#[tauri::command]
pub(crate) async fn phase2_read_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<LoadedDocument> {
    ensure_phase2_development(&app)?;
    database_commands::app_read_document(app, state).await
}

#[tauri::command]
pub(crate) async fn phase2_save_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<SavedDocument> {
    ensure_phase2_development(&app)?;
    database_commands::app_save_document(app, state, request).await
}

#[tauri::command]
pub(crate) async fn phase2_full_backup(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<()> {
    ensure_phase2_development(&app)?;
    database_commands::app_full_backup(app, state, authorizations, request).await
}

#[tauri::command]
pub(crate) fn phase2_lock_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    database_commands::app_lock_database(app, state)
}

#[tauri::command]
pub(crate) fn phase2_close_database(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    database_commands::app_close_database(app, state)
}

#[tauri::command]
pub(crate) fn phase2_quit_application(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<()> {
    ensure_phase2_development(&app)?;
    database_commands::app_quit_application(app, state)
}

#[tauri::command]
pub(crate) fn phase2_get_session_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, DatabaseSessionState>,
) -> Phase2CommandResult<DatabaseSessionStatus> {
    ensure_phase2_development(&app)?;
    database_commands::app_get_session_status(app, state)
}

#[tauri::command]
pub(crate) fn phase2_choose_database_path(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
    request: tauri::ipc::Request<'_>,
) -> Phase2CommandResult<Option<AuthorizedDatabasePath>> {
    ensure_phase2_development(&app)?;
    database_window_commands::app_choose_database_path(app, authorizations, request)
}

#[tauri::command]
pub(crate) fn phase2_list_recent_databases(
    app: tauri::AppHandle,
    authorizations: tauri::State<'_, DatabasePathAuthorizationState>,
) -> Phase2CommandResult<RecentDatabaseChoices> {
    ensure_phase2_development(&app)?;
    database_window_commands::app_list_recent_databases(app, authorizations)
}
