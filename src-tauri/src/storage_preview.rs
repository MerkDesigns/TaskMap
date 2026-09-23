//! Disposable UI baseline only. Never a product storage mode or a legacy migration path.
pub(crate) const ENABLED: bool = cfg!(feature = "storage-free-preview");
pub(crate) const IDENTIFIER: &str = "com.merkdesigns.taskmap.storage-preview";

#[cfg(all(feature = "storage-free-preview", not(debug_assertions)))]
compile_error!("storage-free-preview is debug-only; it must never be packaged for release");

pub(crate) fn validate_launch(identifier: &str) -> Result<(), &'static str> {
    validate_mode(ENABLED, identifier)
}

fn validate_mode(enabled: bool, identifier: &str) -> Result<(), &'static str> {
    if enabled != (identifier == IDENTIFIER) {
        return Err("Storage preview requires its dedicated feature and application identifier");
    }
    Ok(())
}

pub(crate) fn require_legacy_storage() -> Result<(), String> {
    if ENABLED {
        return Err(
            "Legacy storage is disabled in this disposable preview; nothing is saved".into(),
        );
    }
    Ok(())
}

/// Empty baseline for the isolated preview. No legacy storage module is compiled into the app.
#[tauri::command]
pub(crate) fn load_app_data() -> Result<Option<()>, String> {
    if ENABLED {
        Ok(None)
    } else {
        Err("Legacy storage is unavailable".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_cannot_start_with_a_product_identity_or_without_its_feature() {
        assert!(validate_mode(true, IDENTIFIER).is_ok());
        assert!(validate_mode(false, IDENTIFIER).is_err());
        for id in [
            "com.merkdesigns.taskmap",
            "com.merkdesigns.taskmap.dev",
            "unknown",
        ] {
            assert!(validate_mode(true, id).is_err());
            assert!(validate_mode(false, id).is_ok());
        }
    }

    #[test]
    fn preview_denies_storage_before_any_resource_is_opened() {
        assert_eq!(require_legacy_storage().is_err(), ENABLED);
        assert!(
            crate::commands::database_edition::validate_application(IDENTIFIER, false).is_err()
        );
    }
}
