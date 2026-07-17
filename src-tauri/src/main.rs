#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod discord;
mod error;
mod images;
mod model;
mod portable;
mod storage;
mod window_state;

use discord::{set_discord_rpc, DiscordRpc};
use images::{gc_images_at_startup, load_image, pick_image_path, store_image, store_image_path};
use portable::{export_app_data, import_app_data};
use std::time::{SystemTime, UNIX_EPOCH};
use storage::{
    initialize_storage, load_app_data, reset_local_database, save_app_data_incremental,
    StorageState,
};
use tauri::Manager;
use window_state::{restore_window_state, save_window_state};

fn main() {
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0);

    tauri::Builder::default()
        // Register first so a duplicate process exits before other plugins
        // initialize application state.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(StorageState::default())
        .manage(DiscordRpc::new(started_at))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            match initialize_storage(app.handle()) {
                Ok(()) => {
                    if let Err(error) = gc_images_at_startup(app.handle()) {
                        eprintln!("Failed to garbage-collect unused images: {error}");
                    }
                }
                Err(error) => {
                    // Keep the app open so the frontend can present its
                    // recovery flow for missing or unreadable key material.
                    eprintln!("Failed to initialize encrypted storage: {error}");
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = restore_window_state(&window) {
                    eprintln!("Failed to restore window state: {error}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Err(error) = save_window_state(window) {
                    eprintln!("Failed to save window state: {error}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_app_data,
            save_app_data_incremental,
            export_app_data,
            import_app_data,
            reset_local_database,
            store_image,
            load_image,
            store_image_path,
            pick_image_path,
            set_discord_rpc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
