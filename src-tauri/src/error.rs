use serde::Serialize;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum ServiceFailure {
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

impl ServiceFailure {
    pub(crate) fn from_io(error: io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::NotFound => Self::FileNotFound,
            io::ErrorKind::PermissionDenied => Self::PermissionDenied,
            _ => Self::Io(error),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ErrorCode {
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: ErrorCode,
    message: &'static str,
    retryable: bool,
}

impl From<ServiceFailure> for CommandError {
    fn from(failure: ServiceFailure) -> Self {
        use ErrorCode as Code;

        let (code, message, retryable) = match failure {
            ServiceFailure::AlreadyExists => (
                Code::AlreadyExists,
                "A database already exists there.",
                false,
            ),
            ServiceFailure::FileNotFound => (
                Code::FileNotFound,
                "The database file was not found.",
                false,
            ),
            ServiceFailure::PermissionDenied => {
                (Code::PermissionDenied, "Permission was denied.", false)
            }
            ServiceFailure::WriterLockContention => (
                Code::WriterLockContention,
                "Another TaskMap process is already writing this database.",
                true,
            ),
            ServiceFailure::UnsupportedFormat => (
                Code::UnsupportedDatabaseFormat,
                "This TaskMap database format is not supported.",
                false,
            ),
            ServiceFailure::CorruptDatabase => (
                Code::CorruptDatabase,
                "The database is corrupt or has been modified.",
                false,
            ),
            ServiceFailure::WrongPassword => {
                (Code::WrongPassword, "The password is incorrect.", true)
            }
            ServiceFailure::InvalidDocumentPayload => (
                Code::InvalidDocumentPayload,
                "The document payload is invalid.",
                false,
            ),
            ServiceFailure::InvalidInput => (
                Code::InvalidInput,
                "The operation input is invalid or exceeds a safety limit.",
                false,
            ),
            ServiceFailure::DatabasePurposeMismatch => (
                Code::DatabasePurposeMismatch,
                "This database purpose is not allowed in this application edition.",
                false,
            ),
            ServiceFailure::SessionLocked => (Code::SessionLocked, "The database is locked.", true),
            ServiceFailure::SessionNotOpen => {
                (Code::SessionNotOpen, "No database session is open.", false)
            }
            ServiceFailure::SessionAlreadyOpen => (
                Code::SessionAlreadyOpen,
                "Close the current database session before opening another one.",
                false,
            ),
            ServiceFailure::RevisionConflict => (
                Code::RevisionConflict,
                "The document changed before this save completed.",
                true,
            ),
            ServiceFailure::SaveFailure | ServiceFailure::Sqlite(_) => {
                (Code::SaveFailure, "The database could not be saved.", true)
            }
            ServiceFailure::BackupFailure => (
                Code::BackupFailure,
                "A safe database backup could not be created.",
                true,
            ),
            ServiceFailure::Io(_)
            | ServiceFailure::Crypto
            | ServiceFailure::Settings
            | ServiceFailure::Internal => (
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

pub(crate) type ServiceResult<T> = Result<T, ServiceFailure>;
pub(crate) type CommandResult<T> = Result<T, CommandError>;
