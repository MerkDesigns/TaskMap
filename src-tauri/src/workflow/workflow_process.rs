use super::workflow_definition::LineDisplay;
use crate::error::{ServiceFailure, ServiceResult};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

/// A process TaskMap launched for a workflow, with the job that owns its process tree.
pub(crate) struct OwnedProcess {
    child: Child,
    #[cfg(windows)]
    job: job::Job,
}

/// Finds the program a run invocation names. A bare name is looked up on PATH with the platform's
/// executable extensions (so `npm` finds `npm.cmd`), never in the working directory, so a project
/// folder cannot shadow a tool; a relative path is taken from the working directory.
pub(crate) fn resolve_program(
    executable: &str,
    working_directory: Option<&Path>,
    path: Option<OsString>,
    extensions: &[String],
) -> Option<PathBuf> {
    let named = Path::new(executable);
    if named.components().count() > 1 || named.is_absolute() {
        let full = match working_directory {
            Some(directory) if named.is_relative() => directory.join(named),
            _ => named.to_path_buf(),
        };
        return with_extensions(&full, extensions)
            .into_iter()
            .find(|candidate| candidate.is_file());
    }
    std::env::split_paths(&path?)
        .flat_map(|directory| with_extensions(&directory.join(named), extensions))
        .find(|candidate| candidate.is_file())
}

/// The candidate itself when it already has an extension, then each executable extension added.
fn with_extensions(candidate: &Path, extensions: &[String]) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if candidate.extension().is_some() {
        candidates.push(candidate.to_path_buf());
    }
    for extension in extensions {
        let mut name = candidate.as_os_str().to_owned();
        name.push(extension);
        candidates.push(PathBuf::from(name));
    }
    candidates
}

/// The executable extensions Windows tries, from PATHEXT, limited to programs and batch files.
pub(crate) fn executable_extensions() -> Vec<String> {
    let allowed = [".com", ".exe", ".bat", ".cmd"];
    let configured = std::env::var("PATHEXT").unwrap_or_default();
    let mut extensions: Vec<String> = configured
        .split(';')
        .map(|extension| extension.trim().to_ascii_lowercase())
        .filter(|extension| allowed.contains(&extension.as_str()))
        .collect();
    if extensions.is_empty() {
        extensions = allowed
            .iter()
            .map(|extension| extension.to_string())
            .collect();
    }
    extensions
}

impl OwnedProcess {
    /// Starts the program with its argument list, never through a shell. Rust's launcher quotes
    /// arguments for batch files and refuses ones it cannot quote safely.
    pub(crate) fn launch(
        executable: &str,
        arguments: &[String],
        working_directory: Option<&str>,
        display: LineDisplay,
    ) -> ServiceResult<Self> {
        let directory = working_directory.map(Path::new);
        if directory.is_some_and(|directory| !directory.is_dir()) {
            return Err(ServiceFailure::WorkflowLaunchFailure);
        }
        let program = resolve_program(
            executable,
            directory,
            std::env::var_os("PATH"),
            &executable_extensions(),
        )
        .ok_or(ServiceFailure::WorkflowLaunchFailure)?;
        let mut command = Command::new(program);
        command.args(arguments);
        if let Some(directory) = directory {
            command.current_dir(directory);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(match display {
                LineDisplay::Terminal => CREATE_NEW_CONSOLE,
                LineDisplay::Background => CREATE_NO_WINDOW,
            });
        }
        #[cfg(not(windows))]
        let _ = display;
        let child = command
            .spawn()
            .map_err(|_| ServiceFailure::WorkflowLaunchFailure)?;
        // Assigned right after creation, while the new process is still initializing and before it
        // can start children of its own in practice.
        #[cfg(windows)]
        {
            let job = match job::Job::create().and_then(|job| job.assign(&child).map(|()| job)) {
                Ok(job) => job,
                Err(failure) => {
                    let mut child = child;
                    let _ = child.kill();
                    return Err(failure);
                }
            };
            Ok(Self { child, job })
        }
        #[cfg(not(windows))]
        Ok(Self { child })
    }

    /// The exit code once the process has exited, or None while it runs.
    pub(crate) fn exit_code(&mut self) -> ServiceResult<Option<i32>> {
        self.child
            .try_wait()
            .map(|status| status.map(|status| status.code().unwrap_or(-1)))
            .map_err(|_| ServiceFailure::Internal)
    }

    /// Ends the process and every process it started, and nothing else.
    pub(crate) fn stop(&mut self) -> ServiceResult<()> {
        if self.exit_code()?.is_some() {
            return Ok(());
        }
        #[cfg(windows)]
        return self.job.terminate();
        #[cfg(not(windows))]
        self.child.kill().map_err(|_| ServiceFailure::Internal)
    }
}

/// Asks Windows to open a website, file or folder with its default app, as `start` did. Uses the
/// plain open verb, so nothing is elevated; what opens is not owned by TaskMap and is not stopped.
pub(crate) fn open_target(target: &str, working_directory: Option<&str>) -> ServiceResult<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW};
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let wide = |value: &str| {
            std::ffi::OsStr::new(value)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect::<Vec<u16>>()
        };
        let verb = wide("open");
        let file = wide(target);
        let directory = working_directory.map(wide);
        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            lpVerb: verb.as_ptr(),
            lpFile: file.as_ptr(),
            lpDirectory: directory
                .as_ref()
                .map_or(std::ptr::null(), |value| value.as_ptr()),
            nShow: SW_SHOWNORMAL,
            ..Default::default()
        };
        if unsafe { ShellExecuteExW(&mut info) } == 0 {
            return Err(ServiceFailure::WorkflowLaunchFailure);
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (target, working_directory);
        Err(ServiceFailure::WorkflowLaunchFailure)
    }
}

#[cfg(windows)]
mod job {
    use crate::error::{ServiceFailure, ServiceResult};
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, TerminateJobObject,
    };

    /// A job object without kill-on-close: dropping it (as quitting TaskMap does) leaves the
    /// processes running and only ends TaskMap's ownership of them.
    pub(super) struct Job(HANDLE);

    // The handle is only used through the job object API, which is thread-safe.
    unsafe impl Send for Job {}

    impl Job {
        pub(super) fn create() -> ServiceResult<Self> {
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                Err(ServiceFailure::WorkflowLaunchFailure)
            } else {
                Ok(Self(handle))
            }
        }

        pub(super) fn assign(&self, child: &Child) -> ServiceResult<()> {
            let assigned =
                unsafe { AssignProcessToJobObject(self.0, child.as_raw_handle() as HANDLE) };
            if assigned == 0 {
                Err(ServiceFailure::WorkflowLaunchFailure)
            } else {
                Ok(())
            }
        }

        pub(super) fn terminate(&self) -> ServiceResult<()> {
            if unsafe { TerminateJobObject(self.0, 1) } == 0 {
                Err(ServiceFailure::Internal)
            } else {
                Ok(())
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn extensions() -> Vec<String> {
        vec![".exe".into(), ".cmd".into()]
    }

    #[test]
    fn finds_bare_names_on_path_including_batch_files_but_not_in_the_working_directory() {
        let tools = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        std::fs::write(tools.path().join("npm.cmd"), "").unwrap();
        std::fs::write(project.path().join("npm.exe"), "").unwrap();
        let path = Some(tools.path().as_os_str().to_owned());

        let found = resolve_program("npm", Some(project.path()), path.clone(), &extensions());
        assert_eq!(found, Some(tools.path().join("npm.cmd")));
        assert_eq!(
            resolve_program("missing", Some(project.path()), path, &extensions()),
            None
        );
    }

    #[test]
    fn takes_relative_paths_from_the_working_directory() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir(project.path().join("scripts")).unwrap();
        std::fs::write(project.path().join("scripts").join("start.cmd"), "").unwrap();

        let found = resolve_program("scripts/start", Some(project.path()), None, &extensions());
        assert_eq!(
            found,
            Some(project.path().join("scripts").join("start.cmd"))
        );
        let explicit = resolve_program(
            "scripts/start.cmd",
            Some(project.path()),
            None,
            &extensions(),
        );
        assert_eq!(
            explicit,
            Some(project.path().join("scripts").join("start.cmd"))
        );
    }
}
