use crate::error::{command_result, CommandResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Child;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri_plugin_dialog::DialogExt;

const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum RunMode {
    Terminal,
    Background,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandRunnerCommand {
    command: String,
    working_directory: Option<String>,
    run_mode: RunMode,
    #[serde(default)]
    run_as_admin: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandStartResult {
    index: usize,
    started: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandRunStatus {
    run_id: String,
    running: bool,
}

#[derive(Debug, PartialEq, Eq)]
struct LaunchSpec {
    executable: &'static str,
    args: Vec<String>,
    working_directory: Option<String>,
    creation_flags: u32,
    run_as_admin: bool,
}

enum TrackedProcess {
    Child(Child),
    #[cfg(target_os = "windows")]
    Elevated {
        handle: usize,
        process_id: u32,
    },
}

#[cfg(target_os = "windows")]
fn terminate_process_tree(process_id: u32) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    let status = Command::new("taskkill.exe")
        .args(["/PID", &process_id.to_string(), "/T", "/F"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| format!("Could not start taskkill.exe: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "taskkill.exe could not stop process tree {process_id}"
        ))
    }
}

#[cfg(target_os = "windows")]
fn terminate_elevated_process_tree(process_id: u32) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW};
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let wide = |value: &str| {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<u16>>()
    };
    let verb = wide("runas");
    let executable = wide("taskkill.exe");
    let parameters = wide(&format!("/PID {process_id} /T /F"));
    let mut execute = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        lpVerb: verb.as_ptr(),
        lpFile: executable.as_ptr(),
        lpParameters: parameters.as_ptr(),
        nShow: SW_HIDE,
        ..Default::default()
    };
    if unsafe { ShellExecuteExW(&mut execute) } == 0 {
        return Err(format!(
            "Could not start elevated taskkill.exe: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

impl TrackedProcess {
    fn is_running(&mut self) -> Result<bool, String> {
        match self {
            Self::Child(child) => child
                .try_wait()
                .map(|status| status.is_none())
                .map_err(|error| format!("Could not query command process: {error}")),
            #[cfg(target_os = "windows")]
            Self::Elevated { handle, .. } => {
                use windows_sys::Win32::Foundation::WAIT_TIMEOUT;
                use windows_sys::Win32::System::Threading::WaitForSingleObject;
                let result = unsafe { WaitForSingleObject(*handle as _, 0) };
                Ok(result == WAIT_TIMEOUT)
            }
        }
    }

    fn stop(&mut self) -> Result<(), String> {
        match self {
            Self::Child(child) => {
                #[cfg(target_os = "windows")]
                {
                    terminate_process_tree(child.id()).or_else(|error| {
                        if child.try_wait().ok().flatten().is_some() {
                            Ok(())
                        } else {
                            Err(error)
                        }
                    })
                }
                #[cfg(not(target_os = "windows"))]
                {
                    child
                        .kill()
                        .map_err(|error| format!("Could not stop command process: {error}"))
                }
            }
            #[cfg(target_os = "windows")]
            Self::Elevated { process_id, .. } => terminate_process_tree(*process_id)
                .or_else(|_| terminate_elevated_process_tree(*process_id)),
        }
    }
}

impl Drop for TrackedProcess {
    fn drop(&mut self) {
        #[cfg(target_os = "windows")]
        if let Self::Elevated { handle, .. } = self {
            use windows_sys::Win32::Foundation::CloseHandle;
            unsafe {
                CloseHandle(*handle as _);
            }
        }
    }
}

#[derive(Default)]
pub(crate) struct CommandRunnerState {
    next_run_id: AtomicU64,
    processes: Mutex<HashMap<String, TrackedProcess>>,
}

fn validate_commands(commands: &[CommandRunnerCommand]) -> Result<(), String> {
    for (index, command) in commands.iter().enumerate() {
        if command.command.trim().is_empty() {
            return Err(format!("commands[{index}].command must not be empty"));
        }
    }
    Ok(())
}

fn launch_spec(command: &CommandRunnerCommand) -> LaunchSpec {
    let (shell_switch, creation_flags) = match command.run_mode {
        RunMode::Terminal => ("/K", CREATE_NEW_CONSOLE),
        RunMode::Background => ("/C", CREATE_NO_WINDOW),
    };
    LaunchSpec {
        executable: "cmd.exe",
        args: vec![
            "/D".to_string(),
            "/S".to_string(),
            shell_switch.to_string(),
            command.command.clone(),
        ],
        working_directory: command
            .working_directory
            .as_deref()
            .filter(|directory| !directory.trim().is_empty())
            .map(str::to_string),
        creation_flags,
        run_as_admin: command.run_as_admin,
    }
}

#[cfg(target_os = "windows")]
fn start_elevated_command(spec: &LaunchSpec, run_mode: RunMode) -> Result<TrackedProcess, String> {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{SW_HIDE, SW_SHOWNORMAL};

    let wide = |value: &str| {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<u16>>()
    };
    let verb = wide("runas");
    let executable = wide(spec.executable);
    let parameters = wide(&format!(
        "{} {} {} \"{}\"",
        spec.args[0], spec.args[1], spec.args[2], spec.args[3]
    ));
    let directory = spec
        .working_directory
        .as_deref()
        .map(wide)
        .unwrap_or_default();
    if let Some(path) = spec.working_directory.as_deref() {
        if !Path::new(path).is_dir() {
            return Err(format!("Working directory does not exist: {path}"));
        }
    }

    let mut execute = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: verb.as_ptr(),
        lpFile: executable.as_ptr(),
        lpParameters: parameters.as_ptr(),
        lpDirectory: if directory.is_empty() {
            std::ptr::null()
        } else {
            directory.as_ptr()
        },
        nShow: if run_mode == RunMode::Terminal {
            SW_SHOWNORMAL
        } else {
            SW_HIDE
        },
        ..Default::default()
    };
    if unsafe { ShellExecuteExW(&mut execute) } == 0 || execute.hProcess.is_null() {
        return Err(format!(
            "Could not start elevated cmd.exe: {}",
            std::io::Error::last_os_error()
        ));
    }
    use windows_sys::Win32::System::Threading::GetProcessId;
    let process_id = unsafe { GetProcessId(execute.hProcess) };
    if process_id == 0 {
        use windows_sys::Win32::Foundation::CloseHandle;
        unsafe {
            CloseHandle(execute.hProcess);
        }
        return Err(format!(
            "Could not identify elevated cmd.exe: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(TrackedProcess::Elevated {
        handle: execute.hProcess as usize,
        process_id,
    })
}

#[cfg(target_os = "windows")]
fn start_command(command: &CommandRunnerCommand) -> Result<TrackedProcess, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let spec = launch_spec(command);
    if spec.run_as_admin {
        return start_elevated_command(&spec, command.run_mode);
    }
    let mut process = Command::new(spec.executable);
    process.args(&spec.args).creation_flags(spec.creation_flags);
    if let Some(directory) = spec.working_directory {
        process.current_dir(directory);
    }
    process
        .spawn()
        .map(TrackedProcess::Child)
        .map_err(|error| format!("Could not start cmd.exe: {error}"))
}

fn run_saved_commands_inner(
    commands: Vec<CommandRunnerCommand>,
    state: &CommandRunnerState,
) -> Result<Vec<CommandStartResult>, String> {
    validate_commands(&commands)?;

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (commands, state);
        Err("Command Runner is only supported on Windows".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        let mut processes = state
            .processes
            .lock()
            .map_err(|_| "Command process state is unavailable".to_string())?;
        Ok(commands
            .iter()
            .enumerate()
            .map(|(index, command)| match start_command(command) {
                Ok(process) => {
                    let run_id = format!(
                        "command-run-{}",
                        state.next_run_id.fetch_add(1, Ordering::Relaxed) + 1
                    );
                    processes.insert(run_id.clone(), process);
                    CommandStartResult {
                        index,
                        started: true,
                        run_id: Some(run_id),
                        error: None,
                    }
                }
                Err(error) => CommandStartResult {
                    index,
                    started: false,
                    run_id: None,
                    error: Some(error),
                },
            })
            .collect())
    }
}

fn get_run_statuses_inner(
    run_ids: Vec<String>,
    state: &CommandRunnerState,
) -> Result<Vec<CommandRunStatus>, String> {
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Command process state is unavailable".to_string())?;
    let mut statuses = Vec::with_capacity(run_ids.len());
    for run_id in run_ids {
        let running = match processes.get_mut(&run_id) {
            Some(process) => process.is_running()?,
            None => false,
        };
        if !running {
            processes.remove(&run_id);
        }
        statuses.push(CommandRunStatus { run_id, running });
    }
    Ok(statuses)
}

fn stop_saved_commands_inner(
    run_ids: Vec<String>,
    state: &CommandRunnerState,
) -> Result<(), String> {
    let mut processes = state
        .processes
        .lock()
        .map_err(|_| "Command process state is unavailable".to_string())?;
    let mut errors = Vec::new();
    for run_id in run_ids {
        if let Some(mut process) = processes.remove(&run_id) {
            if let Err(error) = process.stop() {
                errors.push(error);
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[tauri::command]
pub(crate) fn pick_command_working_directory(
    app: tauri::AppHandle,
) -> CommandResult<Option<String>> {
    let path = app.dialog().file().blocking_pick_folder();
    command_result(match path {
        Some(path) => Ok(Some(
            path.into_path()
                .map_err(|error| format!("Could not resolve selected folder: {error}"))?
                .to_string_lossy()
                .into_owned(),
        )),
        None => Ok(None),
    })
}

#[tauri::command]
pub(crate) fn run_saved_commands(
    commands: Vec<CommandRunnerCommand>,
    state: tauri::State<'_, CommandRunnerState>,
) -> CommandResult<Vec<CommandStartResult>> {
    command_result(run_saved_commands_inner(commands, &state))
}

#[tauri::command]
pub(crate) fn get_saved_command_run_status(
    run_ids: Vec<String>,
    state: tauri::State<'_, CommandRunnerState>,
) -> CommandResult<Vec<CommandRunStatus>> {
    command_result(get_run_statuses_inner(run_ids, &state))
}

#[tauri::command]
pub(crate) fn stop_saved_commands(
    run_ids: Vec<String>,
    state: tauri::State<'_, CommandRunnerState>,
) -> CommandResult<()> {
    command_result(stop_saved_commands_inner(run_ids, &state))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(
        command: &str,
        working_directory: Option<&str>,
        run_mode: RunMode,
        run_as_admin: bool,
    ) -> CommandRunnerCommand {
        CommandRunnerCommand {
            command: command.to_string(),
            working_directory: working_directory.map(str::to_string),
            run_mode,
            run_as_admin,
        }
    }

    #[test]
    fn rejects_blank_commands() {
        assert!(validate_commands(&[command("  ", None, RunMode::Background, false)]).is_err());
    }

    #[test]
    fn builds_terminal_background_and_admin_launch_specs() {
        let terminal = launch_spec(&command(
            "npm test",
            Some("C:\\project"),
            RunMode::Terminal,
            true,
        ));
        assert_eq!(terminal.executable, "cmd.exe");
        assert_eq!(terminal.args, ["/D", "/S", "/K", "npm test"]);
        assert_eq!(terminal.working_directory.as_deref(), Some("C:\\project"));
        assert_eq!(terminal.creation_flags, CREATE_NEW_CONSOLE);
        assert!(terminal.run_as_admin);

        let background = launch_spec(&command(
            "cargo check",
            Some(""),
            RunMode::Background,
            false,
        ));
        assert_eq!(background.args, ["/D", "/S", "/C", "cargo check"]);
        assert_eq!(background.working_directory, None);
        assert_eq!(background.creation_flags, CREATE_NO_WINDOW);
        assert!(!background.run_as_admin);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn tracks_successful_starts_and_continues_after_invalid_directories() {
        let state = CommandRunnerState::default();
        let results = run_saved_commands_inner(
            vec![
                command(
                    "exit 0",
                    Some("Z:\\taskmap-command-runner-path-that-does-not-exist"),
                    RunMode::Background,
                    false,
                ),
                command("exit 0", None, RunMode::Background, false),
            ],
            &state,
        )
        .expect("Windows command startup should return per-command results");

        assert_eq!(results.len(), 2);
        assert!(!results[0].started);
        assert!(results[0].error.is_some());
        assert!(results[1].started);
        assert!(results[1].run_id.is_some());
        stop_saved_commands_inner(
            results
                .into_iter()
                .filter_map(|result| result.run_id)
                .collect(),
            &state,
        )
        .expect("tracked test commands should stop cleanly");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn stops_a_running_command_process_tree() {
        let state = CommandRunnerState::default();
        let results = run_saved_commands_inner(
            vec![command(
                "ping.exe 127.0.0.1 -n 30 > nul",
                None,
                RunMode::Background,
                false,
            )],
            &state,
        )
        .expect("the test command should start");
        let run_id = results[0]
            .run_id
            .clone()
            .expect("the started command should have a run id");

        stop_saved_commands_inner(vec![run_id.clone()], &state)
            .expect("the running process tree should stop");
        assert_eq!(
            get_run_statuses_inner(vec![run_id], &state).expect("status lookup should succeed")[0]
                .running,
            false
        );
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn reports_unsupported_platform() {
        let error = run_saved_commands_inner(
            vec![command("echo ok", None, RunMode::Background, false)],
            &CommandRunnerState::default(),
        )
        .expect_err("non-Windows platforms must be rejected");
        assert!(error.contains("only supported on Windows"));
    }
}
