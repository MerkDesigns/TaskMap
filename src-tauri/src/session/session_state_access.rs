use super::database_session::{DatabaseSessionState, OpenSession};
use super::session_types::{DatabaseSessionPhase, DatabaseSessionStatus};
use crate::error::{ServiceFailure, ServiceResult};

pub(super) fn ensure_no_open_session(guard: &Option<OpenSession>) -> ServiceResult<()> {
    if guard.is_some() {
        Err(ServiceFailure::SessionAlreadyOpen)
    } else {
        Ok(())
    }
}

pub(super) fn unlocked_session(guard: &mut Option<OpenSession>) -> ServiceResult<&mut OpenSession> {
    let session = guard.as_mut().ok_or(ServiceFailure::SessionNotOpen)?;
    session.key_state.unlocked_key()?;
    Ok(session)
}

pub(super) fn status_from_guard(guard: &Option<OpenSession>) -> DatabaseSessionStatus {
    let Some(session) = guard else {
        return closed_status();
    };
    let phase = if session.key_state.is_pending() {
        DatabaseSessionPhase::PendingUnlock
    } else if session.key_state.is_unlocked() {
        DatabaseSessionPhase::Unlocked
    } else {
        DatabaseSessionPhase::Locked
    };
    DatabaseSessionStatus {
        phase,
        session_id: Some(session.session_id.clone()),
        database_path: Some(session.database_path.to_string_lossy().into_owned()),
        database_id: Some(session.database_id.clone()),
        document_schema_version: Some(session.document_schema_version),
        revision: Some(session.revision),
        last_activity_at: Some(session.last_activity_at.clone()),
    }
}

pub(super) fn authorized_session<'a>(
    guard: &'a mut Option<OpenSession>,
    database_id: &str,
    session_id: &str,
) -> ServiceResult<&'a mut OpenSession> {
    let session = unlocked_session(guard)?;
    if session.database_id != database_id || session.session_id != session_id {
        return Err(ServiceFailure::SessionLocked);
    }
    Ok(session)
}

impl DatabaseSessionState {
    /// Succeeds only for the unlocked session of `database_id` identified by `session_id`.
    pub(crate) fn authorize(&self, database_id: &str, session_id: &str) -> ServiceResult<()> {
        let mut guard = self.guard()?;
        authorized_session(&mut guard, database_id, session_id).map(|_| ())
    }
}

fn closed_status() -> DatabaseSessionStatus {
    DatabaseSessionStatus {
        phase: DatabaseSessionPhase::Closed,
        session_id: None,
        database_path: None,
        database_id: None,
        document_schema_version: None,
        revision: None,
        last_activity_at: None,
    }
}
