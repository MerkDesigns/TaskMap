use crate::phase2_error::{Phase2Failure, Phase2Result};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

const SETTINGS_VERSION: u32 = 1;
const MAX_RECENT_DATABASES: usize = 10;
const SETTINGS_FILENAME: &str = "phase2-database-settings.json";
const MAX_SETTINGS_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentDatabaseSettings {
    pub(crate) version: u32,
    pub(crate) edition: String,
    pub(crate) recent_database_paths: Vec<String>,
    pub(crate) default_database_path: Option<String>,
}

impl RecentDatabaseSettings {
    pub(crate) fn empty(edition: &str) -> Self {
        Self {
            version: SETTINGS_VERSION,
            edition: edition.to_string(),
            recent_database_paths: Vec::new(),
            default_database_path: None,
        }
    }
}

pub(crate) fn load(config_directory: &Path, edition: &str) -> Phase2Result<RecentDatabaseSettings> {
    let path = settings_path(config_directory);
    if !path.exists() {
        return Ok(RecentDatabaseSettings::empty(edition));
    }
    let metadata = std::fs::metadata(&path).map_err(Phase2Failure::from_io)?;
    if metadata.len() > MAX_SETTINGS_BYTES {
        return Err(Phase2Failure::Settings);
    }
    let bytes = std::fs::read(path).map_err(Phase2Failure::from_io)?;
    let settings: RecentDatabaseSettings =
        serde_json::from_slice(&bytes).map_err(|_| Phase2Failure::Settings)?;
    if settings.version != SETTINGS_VERSION
        || settings.edition != edition
        || settings.recent_database_paths.len() > MAX_RECENT_DATABASES
        || settings
            .recent_database_paths
            .iter()
            .any(|path| path.is_empty() || path.len() > 32_767)
        || settings
            .default_database_path
            .as_ref()
            .is_some_and(|path| path.is_empty() || path.len() > 32_767)
    {
        return Err(Phase2Failure::Settings);
    }
    Ok(settings)
}

pub(crate) fn record_recent(
    config_directory: &Path,
    edition: &str,
    database_path: &Path,
) -> Phase2Result<RecentDatabaseSettings> {
    let mut settings = load(config_directory, edition)?;
    let path = database_path.to_string_lossy().into_owned();
    settings.recent_database_paths.retain(|item| item != &path);
    settings.recent_database_paths.insert(0, path.clone());
    settings
        .recent_database_paths
        .truncate(MAX_RECENT_DATABASES);
    if settings.default_database_path.is_none() {
        settings.default_database_path = Some(path);
    }
    save(config_directory, &settings)?;
    Ok(settings)
}

pub(crate) fn save(config_directory: &Path, settings: &RecentDatabaseSettings) -> Phase2Result<()> {
    std::fs::create_dir_all(config_directory).map_err(Phase2Failure::from_io)?;
    let path = settings_path(config_directory);
    let temporary = path.with_extension(format!(
        "json.tmp-{}-{}",
        std::process::id(),
        rand::random::<u64>()
    ));
    let bytes = serde_json::to_vec_pretty(settings).map_err(|_| Phase2Failure::Settings)?;
    if bytes.len() as u64 > MAX_SETTINGS_BYTES {
        return Err(Phase2Failure::Settings);
    }
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(Phase2Failure::from_io)?;
    file.write_all(&bytes).map_err(Phase2Failure::from_io)?;
    file.sync_all().map_err(Phase2Failure::from_io)?;
    drop(file);
    if let Err(error) = atomic_replace(&temporary, &path) {
        let cleanup = std::fs::remove_file(&temporary);
        if let Err(cleanup_error) = cleanup {
            return Err(Phase2Failure::from_io(cleanup_error));
        }
        return Err(error);
    }
    Ok(())
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> Phase2Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>()
    };
    let source = wide(source);
    let destination = wide(destination);
    if unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        Err(Phase2Failure::from_io(std::io::Error::last_os_error()))
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn atomic_replace(source: &Path, destination: &Path) -> Phase2Result<()> {
    std::fs::rename(source, destination).map_err(Phase2Failure::from_io)
}

fn settings_path(config_directory: &Path) -> PathBuf {
    config_directory.join(SETTINGS_FILENAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edition_directories_keep_recent_databases_isolated() {
        let root = tempfile::tempdir().unwrap();
        let stable = root.path().join("stable");
        let development = root.path().join("development");
        let stable_database = root.path().join("stable.tmapdb");
        let development_database = root.path().join("development.tmapdb");

        record_recent(&stable, "stable", &stable_database).unwrap();
        record_recent(&development, "development", &development_database).unwrap();

        assert_eq!(
            load(&stable, "stable").unwrap().recent_database_paths,
            vec![stable_database.to_string_lossy()]
        );
        assert_eq!(
            load(&development, "development")
                .unwrap()
                .recent_database_paths,
            vec![development_database.to_string_lossy()]
        );
    }

    #[test]
    fn settings_replacement_has_no_remove_then_rename_gap_or_leftover_temp_file() {
        let root = tempfile::tempdir().unwrap();
        let config = root.path().join("development");
        let first = root.path().join("first.tmapdb");
        let second = root.path().join("second.tmapdb");
        record_recent(&config, "development", &first).unwrap();
        record_recent(&config, "development", &second).unwrap();
        assert_eq!(
            load(&config, "development").unwrap().recent_database_paths,
            vec![second.to_string_lossy(), first.to_string_lossy()]
        );
        let names: Vec<_> = std::fs::read_dir(&config)
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, vec![std::ffi::OsString::from(SETTINGS_FILENAME)]);
    }
}
