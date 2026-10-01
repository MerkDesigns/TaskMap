// Release builds run without a console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(windows))]
compile_error!("The TaskMap installer is Windows-only.");

mod existing_install;
mod install;
mod payload;
mod shell_paths;

use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri_plugin_dialog::DialogExt;

use existing_install::ExistingInstall;
use install::{InstallError, InstallRequest, InstallStage};
use payload::{PRODUCT_NAME, PRODUCT_VERSION, SIMULATED};
use shell_paths::KnownFolder;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallerDetails {
    product_name: &'static str,
    version: &'static str,
    /// NSIS's per-user default, so the shown folder is where it would install anyway.
    default_location: PathBuf,
    existing: Option<ExistingInstall>,
    /// The legacy TaskMap is installed under the same name; this installer must not replace it.
    legacy_installed: bool,
    simulated: bool,
}

#[tauri::command]
fn installer_details() -> InstallerDetails {
    InstallerDetails {
        product_name: PRODUCT_NAME,
        version: PRODUCT_VERSION,
        default_location: shell_paths::known_folder(KnownFolder::LocalAppData)
            .unwrap_or_default()
            .join(PRODUCT_NAME),
        existing: existing_install::find(PRODUCT_NAME),
        legacy_installed: install::legacy_install_in_the_way(),
        simulated: SIMULATED,
    }
}

/// Like classic installers, picking a parent folder installs into a product-named folder inside it.
fn install_folder_for(picked: PathBuf) -> PathBuf {
    let named = picked
        .file_name()
        .is_some_and(|name| name.eq_ignore_ascii_case(PRODUCT_NAME));
    if named {
        picked
    } else {
        picked.join(PRODUCT_NAME)
    }
}

#[tauri::command]
async fn installer_choose_location(
    app: tauri::AppHandle,
    current: PathBuf,
) -> Result<Option<PathBuf>, ()> {
    let start = current.parent().map(PathBuf::from).unwrap_or(current);
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose where to install TaskMap")
            .set_directory(start)
            .blocking_pick_folder()
            .and_then(|picked| picked.into_path().ok())
            .map(install_folder_for)
    })
    .await
    .map_err(|_| ())
}

#[tauri::command]
async fn installer_run(
    request: InstallRequest,
    on_stage: Channel<InstallStage>,
) -> Result<(), InstallError> {
    tauri::async_runtime::spawn_blocking(move || {
        install::run(&request, |stage| {
            let _ = on_stage.send(stage);
        })
    })
    .await
    .unwrap_or(Err(InstallError::Failed(None)))
}

#[tauri::command]
fn installer_launch() -> Result<(), InstallError> {
    if SIMULATED {
        return Ok(());
    }
    let installed = existing_install::find(PRODUCT_NAME).ok_or(InstallError::NotFound)?;
    Command::new(&installed.executable)
        .current_dir(&installed.location)
        .spawn()
        .map(drop)
        .map_err(InstallError::Start)
}

fn main() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(all(debug_assertions, feature = "mcp-development"))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .invoke_handler(tauri::generate_handler![
            installer_details,
            installer_choose_location,
            installer_run,
            installer_launch
        ])
        .run(tauri::generate_context!())
        .expect("error while running the TaskMap installer");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picking_a_parent_folder_installs_into_a_product_folder() {
        let parent = PathBuf::from(r"D:\Apps");
        assert_eq!(
            install_folder_for(parent.clone()),
            parent.join(PRODUCT_NAME)
        );
        let named = parent.join(PRODUCT_NAME.to_lowercase());
        assert_eq!(install_folder_for(named.clone()), named);
    }
}
