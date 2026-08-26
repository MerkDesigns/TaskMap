fn main() {
    let commands: &'static [&'static str] =
        if std::env::var_os("CARGO_FEATURE_PHASE2_DEVELOPMENT").is_some() {
            &[
                "load_app_data",
                "save_app_data_incremental",
                "export_app_data",
                "import_app_data",
                "reset_local_database",
                "store_image",
                "load_image",
                "store_image_path",
                "pick_image_path",
                "pick_command_working_directory",
                "run_saved_commands",
                "get_saved_command_run_status",
                "stop_saved_commands",
                "set_discord_rpc",
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
                "load_app_data",
                "save_app_data_incremental",
                "export_app_data",
                "import_app_data",
                "reset_local_database",
                "store_image",
                "load_image",
                "store_image_path",
                "pick_image_path",
                "pick_command_working_directory",
                "run_saved_commands",
                "get_saved_command_run_status",
                "stop_saved_commands",
                "set_discord_rpc",
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
