fn main() {
    let commands: &'static [&'static str] =
        if std::env::var_os("CARGO_FEATURE_PHASE2_DEVELOPMENT").is_some() {
            &[
                "app_create_database",
                "app_open_database",
                "app_unlock_database",
                "app_confirm_unlock",
                "app_cancel_pending_unlock",
                "app_read_document",
                "app_save_document",
                "app_full_backup",
                "app_lock_database",
                "app_close_database",
                "app_quit_application",
                "app_get_session_status",
                "app_choose_database_path",
                "app_list_recent_databases",
                "app_database_edition",
                "app_destroy_main_window",
                "app_media_transfer",
                "app_choose_image",
                "app_import_dropped_image",
                "app_view_state",
                "app_load_preferences",
                "app_save_preferences",
                "load_app_data",
                "phase2_create_database",
                "phase2_open_database",
                "phase2_unlock_database",
                "phase2_confirm_unlock",
                "phase2_cancel_pending_unlock",
                "phase2_read_document",
                "phase2_save_document",
                "phase2_full_backup",
                "phase2_lock_database",
                "phase2_close_database",
                "phase2_quit_application",
                "phase2_get_session_status",
                "phase2_choose_database_path",
                "phase2_list_recent_databases",
            ]
        } else {
            &[
                "app_create_database",
                "app_open_database",
                "app_unlock_database",
                "app_confirm_unlock",
                "app_cancel_pending_unlock",
                "app_read_document",
                "app_save_document",
                "app_full_backup",
                "app_lock_database",
                "app_close_database",
                "app_quit_application",
                "app_get_session_status",
                "app_choose_database_path",
                "app_list_recent_databases",
                "app_database_edition",
                "app_destroy_main_window",
                "app_media_transfer",
                "app_choose_image",
                "app_import_dropped_image",
                "app_view_state",
                "app_load_preferences",
                "app_save_preferences",
                "load_app_data",
            ]
        };

    let capabilities_path_pattern = if std::env::var_os("CARGO_FEATURE_MCP_DEVELOPMENT").is_some() {
        "./capabilities/**/*.json"
    } else {
        "./capabilities/*.json"
    };
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(commands))
        .capabilities_path_pattern(capabilities_path_pattern);
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
