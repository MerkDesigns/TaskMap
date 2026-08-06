use super::database_session::OpenSession;
use super::session_types::{DatabaseSessionPhase, DatabaseSessionStatus};
use crate::phase2_error::{Phase2Failure, Phase2Result};

pub(super) fn ensure_no_open_session(guard: &Option<OpenSession>) -> Phase2Result<()> {
    if guard.is_some() {
        Err(Phase2Failure::SessionAlreadyOpen)
    } else {
        Ok(())
    }
}

pub(super) fn unlocked_session(guard: &mut Option<OpenSession>) -> Phase2Result<&mut OpenSession> {
    let session = guard.as_mut().ok_or(Phase2Failure::SessionNotOpen)?;
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
