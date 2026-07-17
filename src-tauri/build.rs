fn main() {
    const COMMANDS: &[&str] = &[
        "load_app_data",
        "save_app_data_incremental",
        "export_app_data",
        "import_app_data",
        "reset_local_database",
        "store_image",
        "load_image",
        "store_image_path",
        "pick_image_path",
        "set_discord_rpc",
    ];

    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
