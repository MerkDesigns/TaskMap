use crate::error::{ServiceFailure, ServiceResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(crate) const MAX_STEPS: usize = 32;
pub(crate) const MAX_ARGUMENTS: usize = 64;
pub(crate) const MAX_TEXT_BYTES: usize = 4096;

/// How a step's process is shown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum StepDisplay {
    /// Its own visible console window.
    Terminal,
    /// No window; tracked like any other step.
    Background,
}

/// One structured step: an executable and its arguments, never a shell string.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct WorkflowStep {
    pub executable: String,
    pub arguments: Vec<String>,
    pub working_directory: Option<String>,
    pub display: StepDisplay,
    /// The next step starts only after this one exits.
    pub wait_for_exit: bool,
}

fn valid_text(value: &str) -> bool {
    value.len() <= MAX_TEXT_BYTES && !value.contains('\0')
}

pub(crate) fn validate(steps: &[WorkflowStep]) -> ServiceResult<()> {
    let valid = !steps.is_empty()
        && steps.len() <= MAX_STEPS
        && steps.iter().all(|step| {
            !step.executable.trim().is_empty()
                && valid_text(&step.executable)
                && step.arguments.len() <= MAX_ARGUMENTS
                && step.arguments.iter().all(|argument| valid_text(argument))
                && step
                    .working_directory
                    .as_deref()
                    .is_none_or(|directory| !directory.trim().is_empty() && valid_text(directory))
        });
    if valid {
        Ok(())
    } else {
        Err(ServiceFailure::InvalidInput)
    }
}

/// The SHA-256 of the definition's canonical JSON; any change to any step changes it.
pub(crate) fn definition_hash(steps: &[WorkflowStep]) -> ServiceResult<String> {
    // Struct serialization writes fields in declaration order, so the encoding is canonical.
    let canonical = serde_json::to_vec(steps).map_err(|_| ServiceFailure::Internal)?;
    let digest = Sha256::digest(&canonical);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    pub(crate) fn step(executable: &str) -> WorkflowStep {
        WorkflowStep {
            executable: executable.into(),
            arguments: vec!["run".into(), "dev".into()],
            working_directory: Some("C:\\Projects\\App".into()),
            display: StepDisplay::Terminal,
            wait_for_exit: false,
        }
    }

    #[test]
    fn accepts_structured_steps_within_limits() {
        assert!(validate(&[step("npm"), step("cargo")]).is_ok());
    }

    #[test]
    fn rejects_empty_workflows_blank_executables_and_oversized_input() {
        assert!(validate(&[]).is_err());
        assert!(validate(&[step("  ")]).is_err());
        let mut blank_directory = step("npm");
        blank_directory.working_directory = Some(" ".into());
        assert!(validate(&[blank_directory]).is_err());
        let mut nul = step("npm");
        nul.arguments.push("a\0b".into());
        assert!(validate(&[nul]).is_err());
        let mut many = step("npm");
        many.arguments = vec!["x".into(); MAX_ARGUMENTS + 1];
        assert!(validate(&[many]).is_err());
        assert!(validate(&vec![step("npm"); MAX_STEPS + 1]).is_err());
    }

    #[test]
    fn rejects_unknown_fields_such_as_a_shell_string() {
        let json = r#"[{"executable":"cmd.exe","arguments":[],"workingDirectory":null,
            "display":"terminal","waitForExit":false,"command":"del /q *"}]"#;
        assert!(serde_json::from_str::<Vec<WorkflowStep>>(json).is_err());
    }

    #[test]
    fn hashes_identically_for_equal_definitions_and_differently_for_any_change() {
        let base = definition_hash(&[step("npm")]).unwrap();
        assert_eq!(base, definition_hash(&[step("npm")]).unwrap());
        assert_eq!(base.len(), 64);
        let mut changed = step("npm");
        changed.wait_for_exit = true;
        assert_ne!(base, definition_hash(&[changed]).unwrap());
        let mut argument = step("npm");
        argument.arguments[1] = "build".into();
        assert_ne!(base, definition_hash(&[argument]).unwrap());
        assert_ne!(base, definition_hash(&[step("npm"), step("npm")]).unwrap());
    }
}
