#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod database;
mod discord;
mod error;
mod files;
mod images;
mod model;
mod phase2_error;
mod portable;
mod session;
mod settings;
mod storage;
mod window_state;

#[cfg(feature = "phase2-development")]
use commands::database_commands;
use commands::database_window_commands;
use commands::{
    get_saved_command_run_status, pick_command_working_directory, run_saved_commands,
    stop_saved_commands, CommandRunnerState,
};
use discord::{set_discord_rpc, DiscordRpc};
use files::database_path_authorization::DatabasePathAuthorizationState;
use images::{gc_images_at_startup, load_image, pick_image_path, store_image, store_image_path};
use portable::{export_app_data, import_app_data};
use session::database_session::DatabaseSessionState;
use std::time::{SystemTime, UNIX_EPOCH};
use storage::{
    initialize_storage, load_app_data, reset_local_database, save_app_data_incremental,
    StorageState,
};
use tauri::Manager;
use window_state::{restore_window_state, save_window_state};

#[cfg(feature = "phase2-development")]
macro_rules! taskmap_invoke_handler {
    () => {
        tauri::generate_handler![
            load_app_data,
            save_app_data_incremental,
            export_app_data,
            import_app_data,
            reset_local_database,
            store_image,
            load_image,
            store_image_path,
            pick_image_path,
            pick_command_working_directory,
            run_saved_commands,
            get_saved_command_run_status,
            stop_saved_commands,
            set_discord_rpc,
            database_commands::phase2_create_database,
            database_commands::phase2_open_database,
            database_commands::phase2_unlock_database,
            database_commands::phase2_confirm_unlock,
            database_commands::phase2_cancel_pending_unlock,
            database_commands::phase2_read_document,
            database_commands::phase2_save_document,
            database_commands::phase2_full_backup,
            database_commands::phase2_lock_database,
            database_commands::phase2_close_database,
            database_commands::phase2_quit_application,
            database_commands::phase2_get_session_status,
            database_window_commands::phase2_choose_database_path,
            database_window_commands::phase2_list_recent_databases
        ]
    };
}

#[cfg(not(feature = "phase2-development"))]
macro_rules! taskmap_invoke_handler {
    () => {
        tauri::generate_handler![
            load_app_data,
            save_app_data_incremental,
            export_app_data,
            import_app_data,
            reset_local_database,
            store_image,
            load_image,
            store_image_path,
            pick_image_path,
            pick_command_working_directory,
            run_saved_commands,
            get_saved_command_run_status,
            stop_saved_commands,
            set_discord_rpc
        ]
    };
}

fn main() {
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0);

    let builder = tauri::Builder::default()
        // Register first so a duplicate process exits before other plugins
        // initialize application state.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = database_window_commands::reopen_main_window(app);
        }))
        .manage(StorageState::default())
        .manage(CommandRunnerState::default())
        .manage(DiscordRpc::new(started_at))
        .manage(DatabaseSessionState::default())
        .manage(DatabasePathAuthorizationState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(feature = "ui-lab-development"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(all(debug_assertions, feature = "mcp-development"))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .setup(|app| {
            if cfg!(feature = "ui-lab-development") {
                eprintln!("TaskMap UI Lab: product storage and session lifecycle disabled");
                return Ok(());
            }

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
            if cfg!(feature = "ui-lab-development") {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                if let Err(error) = save_window_state(window) {
                    eprintln!("Failed to save window state: {error}");
                }
                if window.state::<DatabaseSessionState>().has_pending_unlock() {
                    let _ = window.state::<DatabaseSessionState>().close_database();
                    database_window_commands::destroy_session_keeper(window.app_handle());
                } else if window.state::<DatabaseSessionState>().has_open_session() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(taskmap_invoke_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
