use crate::files::database_lock::database_file_identity;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use rusqlite::{Connection, OpenFlags};
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use std::time::Duration;

const OPEN_FLAGS: OpenFlags =
    OpenFlags::SQLITE_OPEN_READ_WRITE.union(OpenFlags::SQLITE_OPEN_NO_MUTEX);

pub(crate) struct ReservedDatabase {
    path: PathBuf,
    identity: String,
    file_guard: Option<File>,
    committed: bool,
}

impl ReservedDatabase {
    pub(crate) fn reserve(path: &Path) -> Phase2Result<Self> {
        let parent = path.parent().ok_or(Phase2Failure::InvalidInput)?;
        std::fs::create_dir_all(parent).map_err(Phase2Failure::from_io)?;
        let canonical_parent = std::fs::canonicalize(parent).map_err(Phase2Failure::from_io)?;
        let file_name = path.file_name().ok_or(Phase2Failure::InvalidInput)?;
        let path = canonical_parent.join(file_name);
        let file_guard = create_reserved_file(&path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                Phase2Failure::AlreadyExists
            } else {
                Phase2Failure::from_io(error)
            }
        })?;
        let identity = database_file_identity(&path)?;
        Ok(Self {
            path,
            identity,
            file_guard: Some(file_guard),
            committed: false,
        })
    }

    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    pub(crate) fn identity(&self) -> &str {
        &self.identity
    }

    pub(crate) fn commit(mut self) -> PathBuf {
        drop(self.file_guard.take());
        self.committed = true;
        self.path.clone()
    }

    pub(crate) fn cleanup(mut self) -> Phase2Result<()> {
        let still_owned = database_file_identity(&self.path)
            .map(|identity| identity == self.identity)
            .unwrap_or(false);
        if still_owned {
            drop(self.file_guard.take());
            std::fs::remove_file(&self.path).map_err(Phase2Failure::from_io)?;
        }
        self.committed = true;
        Ok(())
    }
}

impl Drop for ReservedDatabase {
    fn drop(&mut self) {
        if !self.committed
            && database_file_identity(&self.path).is_ok_and(|identity| identity == self.identity)
        {
            drop(self.file_guard.take());
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[cfg(windows)]
fn create_reserved_file(path: &Path) -> std::io::Result<File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};
    OpenOptions::new()
        .create_new(true)
        .read(true)
        .write(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .open(path)
}

#[cfg(not(windows))]
fn create_reserved_file(path: &Path) -> std::io::Result<File> {
    OpenOptions::new()
        .create_new(true)
        .read(true)
        .write(true)
        .open(path)
}

pub(crate) fn open_connection(path: &Path) -> Phase2Result<Connection> {
    if !path.is_file() {
        return Err(Phase2Failure::FileNotFound);
    }
    configure(Connection::open_with_flags(path, OPEN_FLAGS).map_err(map_open_error)?)
}

fn configure(connection: Connection) -> Phase2Result<Connection> {
    connection.busy_timeout(Duration::from_secs(2))?;
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.pragma_update(None, "journal_mode", "DELETE")?;
    connection.pragma_update(None, "synchronous", "FULL")?;
    connection.pragma_update(None, "temp_store", "MEMORY")?;
    Ok(connection)
}

fn map_open_error(error: rusqlite::Error) -> Phase2Failure {
    match &error {
        rusqlite::Error::SqliteFailure(code, _) if code.code == rusqlite::ErrorCode::ReadOnly => {
            Phase2Failure::PermissionDenied
        }
        _ => Phase2Failure::Sqlite(error),
    }
}
