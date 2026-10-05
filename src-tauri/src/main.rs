#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod database;
mod error;
mod files;
mod image_processing;
mod session;
mod settings;
mod storage_preview;
mod tray;
mod webview_browser_features;
mod window_state;
mod workflow;

use commands::database_commands;
use commands::database_window_commands;
use files::database_path_authorization::DatabasePathAuthorizationState;
use session::database_session::DatabaseSessionState;
use tauri::Manager;
mod windows_session_notifications;
use window_state::{restore_window_state, save_window_state};

macro_rules! taskmap_invoke_handler {
    () => {
        tauri::generate_handler![
            storage_preview::load_app_data,
            database_commands::app_create_database,
            database_commands::app_open_database,
            database_commands::app_unlock_database,
            database_commands::app_confirm_unlock,
            database_commands::app_cancel_pending_unlock,
            database_commands::app_read_document,
            database_commands::app_save_document,
            database_commands::app_full_backup,
            database_commands::app_lock_database,
            database_commands::app_close_database,
            database_commands::app_quit_application,
            database_commands::app_get_session_status,
            database_window_commands::app_choose_database_path,
            database_window_commands::app_list_recent_databases,
            database_window_commands::app_database_edition,
            database_window_commands::app_destroy_main_window,
            commands::application_resources::app_media_transfer,
            commands::application_image_picker::app_choose_image,
            commands::application_image_drop::app_import_dropped_image,
            commands::application_resources::app_view_state,
            commands::application_resources::app_load_preferences,
            commands::application_resources::app_save_preferences,
            commands::application_workflow::app_workflow_trust_state,
            commands::application_workflow::app_workflow_trust,
            commands::application_workflow::app_workflow_run,
            commands::application_workflow::app_workflow_status,
            commands::application_workflow::app_workflow_stop,
            commands::application_workflow::app_workflow_choose_folder,
        ]
    };
}

fn main() {
    // Check before single-instance/plugin setup: a misconfigured preview must not contact the old app.
    let context = tauri::generate_context!();
    storage_preview::validate_launch(&context.config().identifier)
        .expect("unsafe storage-preview launch configuration");

    let builder = tauri::Builder::default()
        // Register first so a duplicate process exits before other plugins
        // initialize application state.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = database_window_commands::reopen_main_window(app);
        }))
        .manage(DatabaseSessionState::default())
        .manage(DatabasePathAuthorizationState::default())
        .manage(tray::TrayLock::default())
        .manage(workflow::workflow_runs::WorkflowRuns::default())
        .manage(workflow::workflow_trust::WorkflowTrust::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(feature = "storage-free-preview"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(all(debug_assertions, feature = "mcp-development"))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .setup(|app| {
            if storage_preview::ENABLED {
                eprintln!("TaskMap storage-free preview: no database, keyring, image GC or window-state access");
                return Ok(());
            }

            tray::install(app.handle())?;

            if let Some(window) = app.get_webview_window("main") {
                webview_browser_features::disable_browser_features(&window);
                windows_session_notifications::install(&window).map_err(std::io::Error::other)?;
                if let Err(error) = restore_window_state(&window) {
                    eprintln!("Failed to restore window state: {error}");
                }
                database_window_commands::show_main_window_eventually(&window);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            commands::application_image_drop::capture_drop(window, event);
            if storage_preview::ENABLED {
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
                    // The frontend flushes before destroying the main window.
                }
            }
        })
        .invoke_handler(taskmap_invoke_handler!())
        .run(context)
        .expect("error while running tauri application");
}
