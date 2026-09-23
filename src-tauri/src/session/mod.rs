pub(crate) mod database_session;
mod session_key_state;
mod session_lifecycle;
mod session_opening;
mod session_state_access;
mod session_support;
mod session_types;

pub(crate) use session_key_state::PENDING_UNLOCK_TIMEOUT;
pub(crate) use session_types::{
    DatabaseSessionStatus, LoadedDocument, PendingLoadedDocument, SavedDocument, SensitiveDocument,
    SessionOperation,
};

#[cfg(test)]
use session_types::DatabaseSessionPhase;
mod image_drop_authorizations;
mod session_image_drop;

#[cfg(test)]
mod application_resource_tests;
#[cfg(test)]
mod phase2_concurrency_recovery_tests;
#[cfg(test)]
mod phase2_tests;
#[cfg(test)]
mod session_authorization_tests;
mod session_media_file;
pub(crate) mod session_media_transfer;
mod session_view_state;
