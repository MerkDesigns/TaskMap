use crate::error::{ServiceFailure, ServiceResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(crate) const MAX_LINES: usize = 32;
pub(crate) const MAX_INVOCATIONS_PER_LINE: usize = 8;
pub(crate) const MAX_ARGUMENTS: usize = 64;
pub(crate) const MAX_TEXT_BYTES: usize = 4096;

/// How a line's run invocations are shown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum LineDisplay {
    /// Each in its own visible console window.
    Terminal,
    /// No window; tracked like any other process.
    Background,
}

/// One structured action of a line: a program with its arguments, or a target Windows opens with
/// its default app. Never a shell string.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum Invocation {
    Run {
        executable: String,
        arguments: Vec<String>,
    },
    Open {
        target: String,
    },
}

/// A line runs its invocations in order, each after the previous one exited successfully; all of a
/// workflow's lines start together.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct WorkflowLine {
    pub invocations: Vec<Invocation>,
    pub working_directory: Option<String>,
    pub display: LineDisplay,
}

fn valid_text(value: &str) -> bool {
    value.len() <= MAX_TEXT_BYTES && !value.contains('\0')
}

fn valid_name(value: &str) -> bool {
    !value.trim().is_empty() && valid_text(value)
}

fn valid_invocation(invocation: &Invocation) -> bool {
    match invocation {
        Invocation::Run {
            executable,
            arguments,
        } => {
            valid_name(executable)
                && arguments.len() <= MAX_ARGUMENTS
                && arguments.iter().all(|argument| valid_text(argument))
        }
        Invocation::Open { target } => valid_name(target),
    }
}

pub(crate) fn validate(lines: &[WorkflowLine]) -> ServiceResult<()> {
    let valid = !lines.is_empty()
        && lines.len() <= MAX_LINES
        && lines.iter().all(|line| {
            !line.invocations.is_empty()
                && line.invocations.len() <= MAX_INVOCATIONS_PER_LINE
                && line.invocations.iter().all(valid_invocation)
                && line.working_directory.as_deref().is_none_or(valid_name)
        });
    if valid {
        Ok(())
    } else {
        Err(ServiceFailure::InvalidInput)
    }
}

/// The SHA-256 of the definition's canonical JSON; any change to any line changes it.
pub(crate) fn definition_hash(lines: &[WorkflowLine]) -> ServiceResult<String> {
    // Struct serialization writes fields in declaration order, so the encoding is canonical.
    let canonical = serde_json::to_vec(lines).map_err(|_| ServiceFailure::Internal)?;
    let digest = Sha256::digest(&canonical);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(executable: &str, arguments: &[&str]) -> Invocation {
        Invocation::Run {
            executable: executable.into(),
            arguments: arguments
                .iter()
                .map(|argument| argument.to_string())
                .collect(),
        }
    }

    fn line(invocations: Vec<Invocation>) -> WorkflowLine {
        WorkflowLine {
            invocations,
            working_directory: Some("C:\\Projects\\App".into()),
            display: LineDisplay::Terminal,
        }
    }

    #[test]
    fn accepts_runs_and_opens_within_limits() {
        let lines = [
            line(vec![
                run("docker", &["desktop", "start"]),
                run("docker", &["compose", "up", "-d"]),
            ]),
            line(vec![Invocation::Open {
                target: "http://localhost:8081".into(),
            }]),
        ];
        assert!(validate(&lines).is_ok());
    }

    #[test]
    fn rejects_empty_workflows_and_lines_blank_names_and_oversized_input() {
        assert!(validate(&[]).is_err());
        assert!(validate(&[line(vec![])]).is_err());
        assert!(validate(&[line(vec![run("  ", &[])])]).is_err());
        assert!(validate(&[line(vec![Invocation::Open { target: " ".into() }])]).is_err());
        let mut blank_directory = line(vec![run("npm", &[])]);
        blank_directory.working_directory = Some(" ".into());
        assert!(validate(&[blank_directory]).is_err());
        assert!(validate(&[line(vec![run("npm", &["a\0b"])])]).is_err());
        assert!(validate(&[line(vec![run("npm", &["x"; MAX_ARGUMENTS + 1])])]).is_err());
        assert!(validate(&[line(vec![run("npm", &[]); MAX_INVOCATIONS_PER_LINE + 1])]).is_err());
        assert!(validate(&vec![line(vec![run("npm", &[])]); MAX_LINES + 1]).is_err());
    }

    #[test]
    fn rejects_unknown_fields_and_kinds_such_as_a_shell_string() {
        let shell_field = r#"[{"invocations":[{"kind":"run","executable":"cmd.exe","arguments":[],
            "command":"del /q *"}],"workingDirectory":null,"display":"terminal"}]"#;
        assert!(serde_json::from_str::<Vec<WorkflowLine>>(shell_field).is_err());
        let shell_kind = r#"[{"invocations":[{"kind":"shell","line":"del /q *"}],
            "workingDirectory":null,"display":"terminal"}]"#;
        assert!(serde_json::from_str::<Vec<WorkflowLine>>(shell_kind).is_err());
    }

    #[test]
    fn hashes_identically_for_equal_definitions_and_differently_for_any_change() {
        let base = definition_hash(&[line(vec![run("npm", &["run", "dev"])])]).unwrap();
        assert_eq!(
            base,
            definition_hash(&[line(vec![run("npm", &["run", "dev"])])]).unwrap()
        );
        assert_eq!(base.len(), 64);
        assert_ne!(
            base,
            definition_hash(&[line(vec![run("npm", &["run", "build"])])]).unwrap()
        );
        let mut background = line(vec![run("npm", &["run", "dev"])]);
        background.display = LineDisplay::Background;
        assert_ne!(base, definition_hash(&[background]).unwrap());
    }
}
