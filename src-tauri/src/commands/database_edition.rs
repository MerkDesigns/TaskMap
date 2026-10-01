use crate::phase2_error::{Phase2CommandError, Phase2CommandResult, Phase2Failure};

pub(crate) fn validate_application(identifier: &str) -> Phase2CommandResult<&'static str> {
    match identifier {
        "com.merkdesigns.taskmap" => Ok("stable"),
        "com.merkdesigns.taskmap.dev" => Ok("development"),
        _ => Err(Phase2CommandError::from(Phase2Failure::PermissionDenied)),
    }
}

pub(crate) fn database_purpose(edition: &str) -> Phase2CommandResult<&'static str> {
    match edition {
        "stable" => Ok("production"),
        "development" => Ok("development"),
        _ => Err(Phase2CommandError::from(Phase2Failure::PermissionDenied)),
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
