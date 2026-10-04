use super::workflow_definition::{StepDisplay, WorkflowStep};
use crate::error::{ServiceFailure, ServiceResult};
use std::process::{Child, Command};

/// A process TaskMap launched for a workflow step, with the job that owns its process tree.
pub(crate) struct OwnedProcess {
    child: Child,
    #[cfg(windows)]
    job: job::Job,
}

impl OwnedProcess {
    /// Starts the step's executable with its argument list, never through a shell. Rust's launcher
    /// quotes arguments for batch files and refuses ones it cannot quote safely.
    pub(crate) fn launch(step: &WorkflowStep) -> ServiceResult<Self> {
        let mut command = Command::new(&step.executable);
        command.args(&step.arguments);
        if let Some(directory) = &step.working_directory {
            if !std::path::Path::new(directory).is_dir() {
                return Err(ServiceFailure::WorkflowLaunchFailure);
            }
            command.current_dir(directory);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(match step.display {
                StepDisplay::Terminal => CREATE_NEW_CONSOLE,
                StepDisplay::Background => CREATE_NO_WINDOW,
            });
        }
        #[cfg(not(windows))]
        let _ = step.display;
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
