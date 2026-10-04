//! The Workflow Runner's native side (ADR 009): structured step definitions, the device's trust
//! record and the processes TaskMap launched for workflow runs.
pub(crate) mod workflow_definition;
mod workflow_process;
pub(crate) mod workflow_runs;
pub(crate) mod workflow_trust;

use crate::error::{ServiceFailure, ServiceResult};
use std::path::Path;
use workflow_definition::WorkflowStep;
use workflow_runs::{RunStatus, WorkflowRuns};
use workflow_trust::WorkflowTrust;

/// Starts a definition only if this device trusts it for the database; the trust gate lives here,
/// below the UI, so no caller can launch an unreviewed workflow.
pub(crate) fn run_trusted(
    trust: &WorkflowTrust,
    runs: &WorkflowRuns,
    trust_directory: &Path,
    database_id: &str,
    steps: Vec<WorkflowStep>,
) -> ServiceResult<RunStatus> {
    workflow_definition::validate(&steps)?;
    let hash = workflow_definition::definition_hash(&steps)?;
    if !trust.is_trusted(trust_directory, database_id, &hash)? {
        return Err(ServiceFailure::WorkflowUntrusted);
    }
    runs.start(database_id, steps)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use workflow_definition::StepDisplay;

    fn definition() -> Vec<WorkflowStep> {
        vec![WorkflowStep {
            executable: "cmd.exe".into(),
            arguments: vec!["/C".into(), "exit 0".into()],
            working_directory: None,
            display: StepDisplay::Background,
            wait_for_exit: false,
        }]
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
