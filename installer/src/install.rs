//! Runs the embedded NSIS installer silently and adds the shortcuts the user chose.

use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::{Deserialize, Serialize, Serializer};

use crate::existing_install;
use crate::payload::{self, PRODUCT_NAME, SIMULATED, STABLE_EDITION};
use crate::shell_paths::{self, KnownFolder};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub location: PathBuf,
    pub start_menu_shortcut: bool,
    pub desktop_shortcut: bool,
    /// Updating an existing installation keeps its location and shortcuts.
    pub update: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallStage {
    Preparing,
    Installing,
    Shortcuts,
    Finishing,
}

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    #[error("the install location must be an absolute folder path without quotes")]
    InvalidLocation,
    #[error("the installer could not be prepared")]
    Prepare(#[source] std::io::Error),
    #[error("the installer could not be started")]
    Start(#[source] std::io::Error),
    #[error("the installer reported failure ({0:?})")]
    Failed(Option<i32>),
    #[error("TaskMap was installed, but could not be found afterwards")]
    NotFound,
    #[error("TaskMap was installed, but a shortcut could not be created")]
    Shortcut,
    #[error("the legacy TaskMap is installed and must not be replaced")]
    LegacyInstalled,
}

/// The UI receives a stable kind, never paths or OS error text.
impl Serialize for InstallError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(match self {
            Self::InvalidLocation => "invalidLocation",
            Self::Prepare(_) => "prepare",
            Self::Start(_) => "start",
            Self::Failed(_) => "failed",
            Self::NotFound => "notFound",
            Self::Shortcut => "shortcut",
            Self::LegacyInstalled => "legacyInstalled",
        })
    }
}

/// NSIS flags: `/S` silent; fresh installs skip NSIS's own shortcuts (`/NS`) because the chosen ones
/// are created afterwards, and updates keep the existing ones (`/UPDATE`).
fn nsis_flags(update: bool) -> [&'static str; 2] {
    if update {
        ["/S", "/UPDATE"]
    } else {
        ["/S", "/NS"]
    }
}

/// NSIS reads `/D=` raw: it must be the last argument and must not be quoted, even with spaces.
fn nsis_directory_argument(location: &Path) -> Result<String, InstallError> {
    let text = location.to_str().ok_or(InstallError::InvalidLocation)?;
    if !location.is_absolute() || text.contains(['"', '\r', '\n']) {
        return Err(InstallError::InvalidLocation);
    }
    Ok(format!("/D={}", text.trim_end_matches(['\\', '/'])))
}

/// Only the stable edition shares the legacy app's name (and so its install folder and uninstall
/// entry); installing it would replace the one app that can open the legacy data.
pub fn legacy_install_in_the_way() -> bool {
    STABLE_EDITION
        && existing_install::find(PRODUCT_NAME).is_some_and(|install| install.is_legacy())
}

pub fn run(request: &InstallRequest, report: impl Fn(InstallStage)) -> Result<(), InstallError> {
    if legacy_install_in_the_way() {
        return Err(InstallError::LegacyInstalled);
    }
    let directory = nsis_directory_argument(&request.location)?;
    if SIMULATED {
        return simulate(request, report);
    }

    report(InstallStage::Preparing);
    let installer = payload::extract().map_err(InstallError::Prepare)?;

    report(InstallStage::Installing);
    let status = Command::new(&installer.path)
        .args(nsis_flags(request.update))
        .raw_arg(directory)
        .status()
        .map_err(InstallError::Start)?;
    if !status.success() {
        return Err(InstallError::Failed(status.code()));
    }

    if !request.update && (request.start_menu_shortcut || request.desktop_shortcut) {
        report(InstallStage::Shortcuts);
        let installed = existing_install::find(PRODUCT_NAME).ok_or(InstallError::NotFound)?;
        // The same names the NSIS uninstaller removes, so uninstalling cleans them up.
        let link_name = format!("{PRODUCT_NAME}.lnk");
        for (wanted, folder) in [
            (request.start_menu_shortcut, KnownFolder::StartMenuPrograms),
            (request.desktop_shortcut, KnownFolder::Desktop),
        ] {
            if wanted {
                let link = shell_paths::known_folder(folder)
                    .ok_or(InstallError::Shortcut)?
                    .join(&link_name);
                shell_paths::create_shortcut(&link, &installed.executable)
                    .map_err(|_| InstallError::Shortcut)?;
            }
        }
    }

    report(InstallStage::Finishing);
    drop(installer);
    Ok(())
}

/// Development builds walk through the stages without touching the system.
fn simulate(request: &InstallRequest, report: impl Fn(InstallStage)) -> Result<(), InstallError> {
    let pause = || std::thread::sleep(Duration::from_millis(700));
    report(InstallStage::Preparing);
    pause();
    report(InstallStage::Installing);
    pause();
    pause();
    if !request.update && (request.start_menu_shortcut || request.desktop_shortcut) {
        report(InstallStage::Shortcuts);
        pause();
    }
    report(InstallStage::Finishing);
    pause();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_installs_skip_nsis_shortcuts_and_updates_keep_them() {
        assert_eq!(nsis_flags(false), ["/S", "/NS"]);
        assert_eq!(nsis_flags(true), ["/S", "/UPDATE"]);
    }

    #[test]
    fn the_directory_argument_is_raw_and_unquoted_even_with_spaces() {
        let argument = nsis_directory_argument(Path::new(r"C:\Program Files\TaskMap\")).unwrap();
        assert_eq!(argument, r"/D=C:\Program Files\TaskMap");
    }

    #[test]
    fn relative_or_quoted_locations_are_rejected() {
        for location in [r"TaskMap", r#"C:\Task"Map"#] {
            assert!(matches!(
                nsis_directory_argument(Path::new(location)),
                Err(InstallError::InvalidLocation)
            ));
        }
    }

    #[test]
    fn errors_reach_the_ui_as_content_free_kinds() {
        let error = InstallError::Start(std::io::Error::other(r"C:\secret\path"));
        assert_eq!(serde_json::to_string(&error).unwrap(), "\"start\"");
    }
}
