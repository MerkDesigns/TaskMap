//! The Workflow Runner's native side (ADR 009): structured step definitions, the device's trust
//! record and the processes TaskMap launched for workflow runs; also opening a card's folder.
pub(crate) mod workflow_definition;
mod workflow_process;
pub(crate) mod workflow_runs;
pub(crate) mod workflow_trust;

use crate::error::{ServiceFailure, ServiceResult};
use std::path::{Component, Path, Prefix};
use workflow_definition::WorkflowLine;
use workflow_runs::{RunStatus, WorkflowRuns};
use workflow_trust::WorkflowTrust;

/// Starts a definition only if this device trusts it for the database; the trust gate lives here,
/// below the UI, so no caller can launch an unreviewed workflow.
pub(crate) fn run_trusted(
    trust: &WorkflowTrust,
    runs: &WorkflowRuns,
    trust_directory: &Path,
    database_id: &str,
    lines: Vec<WorkflowLine>,
) -> ServiceResult<RunStatus> {
    workflow_definition::validate(&lines)?;
    let hash = workflow_definition::definition_hash(&lines)?;
    if !trust.is_trusted(trust_directory, database_id, &hash)? {
        return Err(ServiceFailure::WorkflowUntrusted);
    }
    runs.start(database_id, lines)
}

/// Longest folder path a card may open; the frontend stores no longer paths.
const MAX_FOLDER_PATH_LENGTH: usize = 4096;

/// Opens a folder card's folder in Explorer. Only an existing directory on a drive letter path is
/// opened, so a card can never run anything, and network or device paths are refused: Windows
/// would authenticate to whatever server a `\\server\share` path in a shared database names.
pub(crate) fn open_local_folder(path: &str) -> ServiceResult<()> {
    let folder = local_folder_path(path)?;
    let metadata = std::fs::metadata(folder).map_err(|_| ServiceFailure::FileNotFound)?;
    if !metadata.is_dir() {
        return Err(ServiceFailure::FileNotFound);
    }
    workflow_process::open_target(path, None)
}

fn local_folder_path(path: &str) -> ServiceResult<&Path> {
    if path.is_empty()
        || path.len() > MAX_FOLDER_PATH_LENGTH
        || path.contains('\0')
        || path.starts_with("\\\\")
        || path.starts_with("//")
    {
        return Err(ServiceFailure::InvalidInput);
    }
    let folder = Path::new(path);
    match folder.components().next() {
        Some(Component::Prefix(prefix))
            if matches!(prefix.kind(), Prefix::Disk(_)) && folder.is_absolute() =>
        {
            Ok(folder)
        }
        _ => Err(ServiceFailure::InvalidInput),
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use workflow_definition::{Invocation, LineDisplay};

    fn definition() -> Vec<WorkflowLine> {
        vec![WorkflowLine {
            invocations: vec![Invocation::Run {
                executable: "cmd.exe".into(),
                arguments: vec!["/C".into(), "exit 0".into()],
            }],
            working_directory: None,
            display: LineDisplay::Background,
        }]
    }

    #[test]
    fn opens_only_existing_local_folders() {
        let directory = tempfile::tempdir().unwrap();
        let folder = directory.path().to_string_lossy().into_owned();
        assert!(local_folder_path(&folder).is_ok());
        let file = directory.path().join("note.txt");
        std::fs::write(&file, "x").unwrap();
        let missing = directory.path().join("missing");
        for path in [file, missing] {
            assert!(matches!(
                open_local_folder(&path.to_string_lossy()),
                Err(ServiceFailure::FileNotFound)
            ));
        }
        for path in [
            "",
            "relative\\folder",
            "\\\\server\\share",
            "//server/share",
            "\\\\?\\UNC\\server\\share",
            "\\\\.\\PhysicalDrive0",
            "C:relative",
        ] {
            assert!(
                matches!(local_folder_path(path), Err(ServiceFailure::InvalidInput)),
                "{path}"
            );
        }
    }

    #[test]
    fn refuses_a_definition_this_device_has_not_trusted() {
        let directory = tempfile::tempdir().unwrap();
        let (trust, runs) = (WorkflowTrust::default(), WorkflowRuns::default());
        let refused = run_trusted(&trust, &runs, directory.path(), "db", definition());
        assert!(matches!(refused, Err(ServiceFailure::WorkflowUntrusted)));

        let hash = workflow_definition::definition_hash(&definition()).unwrap();
        trust.record(directory.path(), "db", &hash).unwrap();
        assert!(run_trusted(&trust, &runs, directory.path(), "db", definition()).is_ok());
        let other_database = run_trusted(&trust, &runs, directory.path(), "other", definition());
        assert!(matches!(
            other_database,
            Err(ServiceFailure::WorkflowUntrusted)
        ));
    }
}
