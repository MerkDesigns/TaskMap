use crate::database::connection::ReservedDatabase;
use crate::files::database_lock::database_file_identity;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::{rngs::OsRng, RngCore};
use rusqlite::backup::Backup;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub(crate) fn create_full_backup(
    source: &Connection,
    destination_path: &Path,
) -> Phase2Result<PathBuf> {
    if destination_path.exists() {
        return Err(Phase2Failure::AlreadyExists);
    }
    let temporary_path = unique_temporary_path(destination_path);
    let reservation =
        ReservedDatabase::reserve(&temporary_path).map_err(|_| Phase2Failure::BackupFailure)?;
    let reserved_identity = reservation.identity().to_string();
    let backup_result: Phase2Result<()> = (|| {
        let mut destination =
            Connection::open(&temporary_path).map_err(|_| Phase2Failure::BackupFailure)?;
        {
            let backup =
                Backup::new(source, &mut destination).map_err(|_| Phase2Failure::BackupFailure)?;
            backup
                .run_to_completion(128, Duration::from_millis(5), None)
                .map_err(|_| Phase2Failure::BackupFailure)?;
        }
        destination
            .close()
            .map_err(|_| Phase2Failure::BackupFailure)?;
        Ok(())
    })();

    if backup_result.is_err() {
        reservation.cleanup()?;
        return Err(Phase2Failure::BackupFailure);
    }

    let temporary_path = reservation.commit();
    if move_without_replacement(&temporary_path, destination_path).is_err() {
        if database_file_identity(&temporary_path)
            .is_ok_and(|identity| identity == reserved_identity)
        {
            std::fs::remove_file(&temporary_path).map_err(|_| Phase2Failure::BackupFailure)?;
        }
        return Err(Phase2Failure::BackupFailure);
    }
    Ok(destination_path.to_path_buf())
}

fn unique_temporary_path(destination_path: &Path) -> PathBuf {
    let mut random = [0_u8; 16];
    OsRng.fill_bytes(&mut random);
    let mut value = destination_path.as_os_str().to_os_string();
    value.push(format!(".partial-{}", URL_SAFE_NO_PAD.encode(random)));
    PathBuf::from(value)
}

#[cfg(windows)]
fn move_without_replacement(source: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};

    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let moved = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn move_without_replacement(source: &Path, destination: &Path) -> std::io::Result<()> {
    std::fs::hard_link(source, destination)?;
    std::fs::remove_file(source)
}
