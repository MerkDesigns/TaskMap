use super::{
    database_session::DatabaseSessionState,
    session_media_transfer::MediaReply,
    session_state_access::{authorized_session, unlocked_session},
};
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::path::PathBuf;

impl DatabaseSessionState {
    pub(crate) fn capture_image_drop(&self, paths: &[PathBuf]) -> Phase2Result<Vec<String>> {
        let mut guard = self.guard()?;
        let session = unlocked_session(&mut guard)?;
        Ok(session
            .image_drops
            .issue(paths, &session.database_id, &session.session_id))
    }
    pub(crate) fn import_dropped_image(
        &self,
        database_id: &str,
        session_id: &str,
        token: &str,
    ) -> Phase2Result<MediaReply> {
        let path = {
            let mut guard = self.guard()?;
            let session = authorized_session(&mut guard, database_id, session_id)?;
            session
                .image_drops
                .take(token, database_id, session_id)
                .ok_or(Phase2Failure::PermissionDenied)?
        };
        // File intake rechecks this authority before and after processing off the renderer thread.
        self.import_media_file(database_id, session_id, &path)
    }
}
