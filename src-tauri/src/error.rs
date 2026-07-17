use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CommandErrorCode {
    MissingKey,
    DecryptFailed,
    InvalidData,
    InvalidExport,
    ResourceLimit,
    NotFound,
    Io,
    Database,
    Keyring,
    Internal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: CommandErrorCode,
    message: String,
}

impl CommandError {
    fn new(code: CommandErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub(crate) fn from_message(message: String) -> Self {
        let lower = message.to_ascii_lowercase();
        let code = if lower.contains("no database key") || lower.contains("key was found") {
            CommandErrorCode::MissingKey
        } else if lower.contains("decrypt")
            || lower.contains("database key no longer matches")
            || lower.contains("stored database key credential is unreadable")
            || lower.contains("stored database key has an invalid length")
            || lower.contains("stored nonce")
            || lower.contains("stored app data is invalid")
        {
            CommandErrorCode::DecryptFailed
        } else if lower.contains("too large")
            || lower.contains("limit")
            || lower.contains("dimensions")
        {
            CommandErrorCode::ResourceLimit
        } else if lower.contains("export") || lower.contains("bundled image") {
            CommandErrorCode::InvalidExport
        } else if lower.contains("not found") {
            CommandErrorCode::NotFound
        } else if lower.contains("keyring") || lower.contains("credential") {
            CommandErrorCode::Keyring
        } else if lower.contains("database") || lower.contains("sqlite") {
            CommandErrorCode::Database
        } else if lower.contains("file")
            || lower.contains("path")
            || lower.contains("read")
            || lower.contains("write")
        {
            CommandErrorCode::Io
        } else if lower.contains("app data")
            || lower.contains("appdata")
            || lower.contains("schema")
            || lower.contains("canvas content")
            || lower.contains("stored canvas")
            || lower.starts_with("canvas ")
            || lower.starts_with("legacy ")
        {
            CommandErrorCode::InvalidData
        } else {
            CommandErrorCode::Internal
        };
        Self::new(code, message)
    }
}

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::from_message(message)
    }
}

pub(crate) type CommandResult<T> = Result<T, CommandError>;

pub(crate) fn command_result<T>(result: Result<T, String>) -> CommandResult<T> {
    result.map_err(CommandError::from_message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn structured_errors_have_stable_codes() {
        let missing = CommandError::from_message(
            "Encrypted app data exists, but no database key was found".to_string(),
        );
        assert!(matches!(missing.code, CommandErrorCode::MissingKey));

        let limited = CommandError::from_message("Image is too large".to_string());
        assert!(matches!(limited.code, CommandErrorCode::ResourceLimit));

        let malformed = CommandError::from_message(
            "Stored database key credential is unreadable: invalid base64".to_string(),
        );
        assert!(matches!(malformed.code, CommandErrorCode::DecryptFailed));

        let unreadable = CommandError::from_message(
            "Stored database key credential is unreadable: keyring value is not UTF-8".to_string(),
        );
        assert!(matches!(unreadable.code, CommandErrorCode::DecryptFailed));

        let keyring = CommandError::from_message(
            "Could not read database key from keyring: access denied".to_string(),
        );
        assert!(matches!(keyring.code, CommandErrorCode::Keyring));

        let database = CommandError::from_message("Database error: disk I/O failure".to_string());
        assert!(matches!(database.code, CommandErrorCode::Database));
    }
}
