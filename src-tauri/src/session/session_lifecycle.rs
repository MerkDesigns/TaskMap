use super::database_session::DatabaseSessionState;
use super::session_state_access::status_from_guard;
use super::session_support::timestamp;
use super::session_types::DatabaseSessionStatus;
use crate::database::backup_repository::create_full_backup;
use crate::database::connection::open_connection;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::path::Path;

impl DatabaseSessionState {
    pub(crate) fn full_backup(&self, destination: &Path) -> Phase2Result<()> {
        let guard = self.guard()?;
        let session = guard.as_ref().ok_or(Phase2Failure::SessionNotOpen)?;
        if session.key_state.is_pending() {
            return Err(Phase2Failure::SessionLocked);
        }
        let source = open_connection(&session.database_path)?;
        create_full_backup(&source, destination).map(|_| ())
    }

    pub(crate) fn lock_database(&self) -> Phase2Result<DatabaseSessionStatus> {
        let mut guard = match self.inner.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                let mut guard = poisoned.into_inner();
                *guard = None;
                return Ok(status_from_guard(&guard));
            }
        };
        let pending = guard
            .as_ref()
            .ok_or(Phase2Failure::SessionNotOpen)?
            .key_state
            .is_pending();
        if pending {
            *guard = None;
            return Ok(status_from_guard(&guard));
        }
        if let Some(session) = guard.as_mut() {
            session.key_state.clear();
            session.last_activity_at = timestamp();
        }
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn close_database(&self) -> Phase2Result<DatabaseSessionStatus> {
        let mut guard = match self.inner.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        *guard = None;
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn quit_session(&self) -> Phase2Result<()> {
        self.close_database()?;
        Ok(())
    }

    pub(crate) fn get_status(&self) -> Phase2Result<DatabaseSessionStatus> {
        let guard = self.guard()?;
        Ok(status_from_guard(&guard))
    }

    pub(crate) fn has_open_session(&self) -> bool {
        match self.inner.lock() {
            Ok(guard) => guard.is_some(),
            Err(poisoned) => poisoned.into_inner().is_some(),
        }
    }

    pub(crate) fn has_pending_unlock(&self) -> bool {
        match self.inner.lock() {
            Ok(guard) => guard
                .as_ref()
                .is_some_and(|session| session.key_state.is_pending()),
            Err(poisoned) => poisoned
                .into_inner()
                .as_ref()
                .is_some_and(|session| session.key_state.is_pending()),
        }
    }

    #[allow(dead_code)]
    pub(crate) fn lock_for_os_session(&self) -> Phase2Result<DatabaseSessionStatus> {
        self.lock_database()
    }

    pub(crate) fn handle_window_recreation_failure(&self) {
        let _ = self.close_database();
    }
}
