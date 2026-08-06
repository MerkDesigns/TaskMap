pub(crate) mod backup_repository;
pub(crate) mod connection;
pub(crate) mod document_repository;
pub(crate) mod envelope_validation;
pub(crate) mod limits;
// The repository is exercised now; its streaming platform adapter is Phase 5.
#[allow(dead_code)]
pub(crate) mod media_repository;
pub(crate) mod schema;
