#[cfg(feature = "phase2-development")]
use serde::Serialize;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum Phase2Failure {
    #[error("database already exists")]
    AlreadyExists,
    #[error("database file was not found")]
    FileNotFound,
    #[error("permission denied")]
    PermissionDenied,
    #[error("database is locked by another writer")]
    WriterLockContention,
    #[error("database format is unsupported")]
    UnsupportedFormat,
    #[error("database structure is corrupt")]
    CorruptDatabase,
    #[error("password authentication failed")]
    WrongPassword,
    #[error("document payload is invalid")]
    InvalidDocumentPayload,
    #[error("command input is invalid")]
    InvalidInput,
    #[cfg(feature = "phase2-development")]
    #[error("database purpose is not allowed for this edition")]
    DatabasePurposeMismatch,
    #[error("database session is locked")]
    SessionLocked,
    #[error("database session is not open")]
    SessionNotOpen,
    #[error("a database session is already open")]
    SessionAlreadyOpen,
    #[error("save revision is stale")]
    RevisionConflict,
    #[error("database save failed")]
    SaveFailure,
    #[error("database backup failed")]
    BackupFailure,
    #[error("I/O operation failed: {0}")]
    Io(#[from] io::Error),
    #[error("SQLite operation failed: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("cryptographic operation failed")]
    Crypto,
    #[error("settings operation failed")]
    Settings,
    #[error("internal operation failed")]
    Internal,
}

impl Phase2Failure {
    pub(crate) fn from_io(error: io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::NotFound => Self::FileNotFound,
            io::ErrorKind::PermissionDenied => Self::PermissionDenied,
            _ => Self::Io(error),
        }
    }
}

#[cfg(feature = "phase2-development")]
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Phase2ErrorCode {
    AlreadyExists,
    FileNotFound,
    PermissionDenied,
    WriterLockContention,
    UnsupportedDatabaseFormat,
    CorruptDatabase,
    WrongPassword,
    InvalidDocumentPayload,
    InvalidInput,
    DatabasePurposeMismatch,
    SessionLocked,
    SessionNotOpen,
    SessionAlreadyOpen,
    RevisionConflict,
    SaveFailure,
    BackupFailure,
    Unexpected,
}

#[cfg(feature = "phase2-development")]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Phase2CommandError {
    code: Phase2ErrorCode,
    message: &'static str,
    retryable: bool,
}

#[cfg(feature = "phase2-development")]
impl From<Phase2Failure> for Phase2CommandError {
    fn from(failure: Phase2Failure) -> Self {
        use Phase2ErrorCode as Code;
        use Phase2Failure as Failure;

        let (code, message, retryable) = match failure {
            Failure::AlreadyExists => (
                Code::AlreadyExists,
                "A database already exists there.",
                false,
            ),
            Failure::FileNotFound => (
                Code::FileNotFound,
                "The database file was not found.",
                false,
            ),
            Failure::PermissionDenied => (Code::PermissionDenied, "Permission was denied.", false),
            Failure::WriterLockContention => (
                Code::WriterLockContention,
                "Another TaskMap process is already writing this database.",
                true,
            ),
            Failure::UnsupportedFormat => (
                Code::UnsupportedDatabaseFormat,
                "This TaskMap database format is not supported.",
                false,
            ),
            Failure::CorruptDatabase => (
                Code::CorruptDatabase,
                "The database is corrupt or has been modified.",
                false,
            ),
            Failure::WrongPassword => (Code::WrongPassword, "The password is incorrect.", true),
            Failure::InvalidDocumentPayload => (
                Code::InvalidDocumentPayload,
                "The document payload is invalid.",
                false,
            ),
            Failure::InvalidInput => (
                Code::InvalidInput,
                "The operation input is invalid or exceeds a safety limit.",
                false,
            ),
            Failure::DatabasePurposeMismatch => (
                Code::DatabasePurposeMismatch,
                "This database purpose is not allowed in this application edition.",
                false,
            ),
            Failure::SessionLocked => (Code::SessionLocked, "The database is locked.", true),
            Failure::SessionNotOpen => {
                (Code::SessionNotOpen, "No database session is open.", false)
            }
            Failure::SessionAlreadyOpen => (
                Code::SessionAlreadyOpen,
                "Close the current database session before opening another one.",
                false,
            ),
            Failure::RevisionConflict => (
                Code::RevisionConflict,
                "The document changed before this save completed.",
                true,
            ),
            Failure::SaveFailure | Failure::Sqlite(_) => {
                (Code::SaveFailure, "The database could not be saved.", true)
            }
            Failure::BackupFailure => (
                Code::BackupFailure,
                "A safe database backup could not be created.",
                true,
            ),
            Failure::Io(_) | Failure::Crypto | Failure::Settings | Failure::Internal => (
                Code::Unexpected,
                "The operation could not be completed.",
                false,
            ),
        };

        Self {
            code,
            message,
            retryable,
        }
    }
}

pub(crate) type Phase2Result<T> = Result<T, Phase2Failure>;
#[cfg(feature = "phase2-development")]
pub(crate) type Phase2CommandResult<T> = Result<T, Phase2CommandError>;
