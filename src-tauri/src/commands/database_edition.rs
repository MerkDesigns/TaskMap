use crate::error::{CommandError, CommandResult, ServiceFailure};

pub(crate) fn validate_application(identifier: &str) -> CommandResult<&'static str> {
    match identifier {
        "com.merkdesigns.taskmap" => Ok("stable"),
        "com.merkdesigns.taskmap.dev" => Ok("development"),
        _ => Err(CommandError::from(ServiceFailure::PermissionDenied)),
    }
}

pub(crate) fn database_purpose(edition: &str) -> CommandResult<&'static str> {
    match edition {
        "stable" => Ok("production"),
        "development" => Ok("development"),
        _ => Err(CommandError::from(ServiceFailure::PermissionDenied)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_product_editions_receive_database_authority() {
        for (identifier, edition, purpose) in [
            ("com.merkdesigns.taskmap", "stable", "production"),
            ("com.merkdesigns.taskmap.dev", "development", "development"),
        ] {
            assert_eq!(validate_application(identifier).unwrap(), edition);
            assert_eq!(database_purpose(edition).unwrap(), purpose);
        }
        assert!(validate_application("unknown").is_err());
        assert!(database_purpose("unknown").is_err());
    }
}
