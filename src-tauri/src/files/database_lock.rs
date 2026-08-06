use crate::phase2_error::{Phase2Failure, Phase2Result};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
#[cfg(not(windows))]
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LockOwner {
    pub(crate) edition: String,
    pub(crate) process_id: u32,
    pub(crate) session_id: String,
    pub(crate) opened_at: String,
}

pub(crate) struct DatabaseWriterLock {
    authority_file: File,
    _database_file_guard: File,
    #[cfg(test)]
    identity: String,
}

impl DatabaseWriterLock {
    pub(crate) fn acquire(database_path: &Path, owner: &LockOwner) -> Phase2Result<Self> {
        let canonical_path =
            std::fs::canonicalize(database_path).map_err(Phase2Failure::from_io)?;
        let database_file_guard = open_identity_guard(&canonical_path)?;
        let metadata = database_file_guard
            .metadata()
            .map_err(Phase2Failure::from_io)?;
        let identity = file_identity(&canonical_path, &database_file_guard, &metadata)?;
        let authority_directory = std::env::temp_dir().join("taskmap-writer-locks-v1");
        std::fs::create_dir_all(&authority_directory).map_err(Phase2Failure::from_io)?;
        let authority_path = authority_directory.join(format!("{identity}.lock"));
        let authority_file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(authority_path)
            .map_err(Phase2Failure::from_io)?;
        authority_file
            .try_lock_exclusive()
            .map_err(map_authority_lock_error)?;
        // Diagnostic metadata is deliberately best-effort. Only the OS lock
        // on the identity-keyed authority file decides writer ownership.
        let _ = write_diagnostic_sidecar(&canonical_path, owner);
        Ok(Self {
            authority_file,
            _database_file_guard: database_file_guard,
            #[cfg(test)]
            identity,
        })
    }

    #[cfg(test)]
    pub(crate) fn identity(&self) -> &str {
        &self.identity
    }
}

fn map_authority_lock_error(error: std::io::Error) -> Phase2Failure {
    if error.kind() == fs2::lock_contended_error().kind() {
        Phase2Failure::WriterLockContention
    } else {
        Phase2Failure::from_io(error)
    }
}

impl Drop for DatabaseWriterLock {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.authority_file);
    }
}

fn write_diagnostic_sidecar(database_path: &Path, owner: &LockOwner) -> Phase2Result<()> {
    let path = diagnostic_path(database_path);
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
        .map_err(Phase2Failure::from_io)?;
    file.set_len(0).map_err(Phase2Failure::from_io)?;
    file.seek(SeekFrom::Start(0))
        .map_err(Phase2Failure::from_io)?;
    serde_json::to_writer(&mut file, owner).map_err(|_| Phase2Failure::Internal)?;
    file.flush().map_err(Phase2Failure::from_io)
}

fn diagnostic_path(database_path: &Path) -> PathBuf {
    let mut value = database_path.as_os_str().to_os_string();
    value.push(".writer.lock");
    PathBuf::from(value)
}

#[cfg(windows)]
fn file_identity(_path: &Path, file: &File, _metadata: &std::fs::Metadata) -> Phase2Result<String> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    if unsafe { GetFileInformationByHandle(file.as_raw_handle() as _, &mut information) } == 0 {
        return Err(Phase2Failure::from_io(std::io::Error::last_os_error()));
    }
    let volume = information.dwVolumeSerialNumber;
    let index =
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
    Ok(format!("{volume:08x}-{index:016x}"))
}

pub(crate) fn database_file_identity(path: &Path) -> Phase2Result<String> {
    let canonical_path = std::fs::canonicalize(path).map_err(Phase2Failure::from_io)?;
    let file = File::open(&canonical_path).map_err(Phase2Failure::from_io)?;
    let metadata = file.metadata().map_err(Phase2Failure::from_io)?;
    file_identity(&canonical_path, &file, &metadata)
}

#[cfg(not(windows))]
fn file_identity(path: &Path, _file: &File, _metadata: &std::fs::Metadata) -> Phase2Result<String> {
    let digest = Sha256::digest(path.as_os_str().as_encoded_bytes());
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(windows)]
fn open_identity_guard(path: &Path) -> Phase2Result<File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};
    OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .open(path)
        .map_err(Phase2Failure::from_io)
}

#[cfg(not(windows))]
fn open_identity_guard(path: &Path) -> Phase2Result<File> {
    File::open(path).map_err(Phase2Failure::from_io)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn owner() -> LockOwner {
        LockOwner {
            edition: "development".to_string(),
            process_id: std::process::id(),
            session_id: "session-one".to_string(),
            opened_at: "1".to_string(),
        }
    }

    fn owner_for(edition: &str) -> LockOwner {
        LockOwner {
            edition: edition.to_string(),
            ..owner()
        }
    }

    #[test]
    fn second_writer_is_rejected_by_file_identity() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("locking.tmapdb");
        File::create(&database).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        assert!(!first.identity().is_empty());
        assert!(diagnostic_path(&database).exists());
        assert!(matches!(
            DatabaseWriterLock::acquire(&database, &owner()),
            Err(Phase2Failure::WriterLockContention)
        ));
    }

    #[test]
    fn relative_and_absolute_paths_share_identity() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("alias.tmapdb");
        File::create(&database).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        let relative = database.parent().unwrap().join(".").join("alias.tmapdb");
        assert!(matches!(
            DatabaseWriterLock::acquire(&relative, &owner()),
            Err(Phase2Failure::WriterLockContention)
        ));
        drop(first);
    }

    #[cfg(windows)]
    #[test]
    fn hard_links_share_identity() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("primary.tmapdb");
        let alias = directory.path().join("alias.tmapdb");
        File::create(&database).unwrap();
        std::fs::hard_link(&database, &alias).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        assert!(matches!(
            DatabaseWriterLock::acquire(&alias, &owner()),
            Err(Phase2Failure::WriterLockContention)
        ));
        drop(first);
    }

    #[cfg(windows)]
    #[test]
    fn case_variants_and_symlinks_share_identity_when_supported() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("CaseAlias.tmapdb");
        File::create(&database).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        let case_variant = directory.path().join("casealias.tmapdb");
        assert!(matches!(
            DatabaseWriterLock::acquire(&case_variant, &owner()),
            Err(Phase2Failure::WriterLockContention)
        ));
        let symlink = directory.path().join("symlink.tmapdb");
        if std::os::windows::fs::symlink_file(&database, &symlink).is_ok() {
            assert!(matches!(
                DatabaseWriterLock::acquire(&symlink, &owner()),
                Err(Phase2Failure::WriterLockContention)
            ));
        }
        drop(first);
    }

    #[test]
    fn stable_and_development_owners_contend_on_the_same_file() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("editions.tmapdb");
        File::create(&database).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner_for("stable")).unwrap();
        assert!(matches!(
            DatabaseWriterLock::acquire(&database, &owner_for("development")),
            Err(Phase2Failure::WriterLockContention)
        ));
        drop(first);
    }

    #[test]
    fn diagnostic_metadata_failure_does_not_decide_writer_ownership() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("metadata-error.tmapdb");
        File::create(&database).unwrap();
        std::fs::create_dir(diagnostic_path(&database)).unwrap();
        let lock = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        drop(lock);
    }

    #[test]
    fn permission_and_unsupported_lock_errors_are_not_contention() {
        assert!(matches!(
            map_authority_lock_error(std::io::Error::from(std::io::ErrorKind::PermissionDenied)),
            Phase2Failure::PermissionDenied
        ));
        assert!(!matches!(
            map_authority_lock_error(std::io::Error::from(std::io::ErrorKind::Unsupported)),
            Phase2Failure::WriterLockContention
        ));
    }

    #[cfg(windows)]
    #[test]
    fn active_writer_prevents_database_path_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("identity-guard.tmapdb");
        let moved = directory.path().join("moved.tmapdb");
        File::create(&database).unwrap();
        let _lock = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        assert!(std::fs::rename(&database, &moved).is_err());
    }

    #[test]
    fn real_child_process_observes_contention_and_os_releases_after_forced_exit() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("multiprocess.tmapdb");
        File::create(&database).unwrap();
        let first = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        assert!(run_lock_child(&database, "expect-contention").success());
        drop(first);

        assert!(run_lock_child(&database, "acquire-and-exit").success());
        let after_forced_exit = DatabaseWriterLock::acquire(&database, &owner()).unwrap();
        drop(after_forced_exit);
    }

    fn run_lock_child(database: &Path, mode: &str) -> std::process::ExitStatus {
        Command::new(std::env::current_exe().unwrap())
            .args([
                "--ignored",
                "--exact",
                "files::database_lock::tests::writer_lock_child_process_entry",
            ])
            .env("TASKMAP_TEST_LOCK_PATH", database)
            .env("TASKMAP_TEST_LOCK_MODE", mode)
            .status()
            .unwrap()
    }

    #[test]
    #[ignore]
    fn writer_lock_child_process_entry() {
        let database = PathBuf::from(std::env::var_os("TASKMAP_TEST_LOCK_PATH").unwrap());
        match std::env::var("TASKMAP_TEST_LOCK_MODE").unwrap().as_str() {
            "expect-contention" => assert!(matches!(
                DatabaseWriterLock::acquire(&database, &owner_for("development")),
                Err(Phase2Failure::WriterLockContention)
            )),
            "acquire-and-exit" => {
                let _lock =
                    DatabaseWriterLock::acquire(&database, &owner_for("development")).unwrap();
                std::process::exit(0);
            }
            mode => panic!("unexpected child mode: {mode}"),
        }
    }
}
