use super::workflow_definition::{Invocation, WorkflowLine};
use super::workflow_process::{open_target, OwnedProcess};
use crate::error::{ServiceFailure, ServiceResult};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Finished runs kept for status queries; the oldest finished run is forgotten first.
const MAX_FINISHED_RUNS: usize = 64;
const WAIT_POLL: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum RunPhase {
    /// A line is still working through its invocations, or a launched process is still alive.
    Running,
    /// Every line completed and every launched process has exited.
    Finished,
    /// An invocation could not start, or one a later invocation waited for exited unsuccessfully.
    Failed,
    Stopped,
}

/// What the UI learns about a run: ids, counts and indexes, never definitions or output.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunStatus {
    pub run_id: String,
    pub phase: RunPhase,
    pub line_count: usize,
    /// The first line that failed, zero-based.
    pub failed_line: Option<usize>,
}

struct RunState {
    failed_line: Option<usize>,
    stopped: bool,
    working_lines: usize,
    processes: Vec<OwnedProcess>,
}

struct Run {
    database_id: String,
    line_count: usize,
    stop_requested: Arc<AtomicBool>,
    state: Arc<Mutex<RunState>>,
}

/// Workflow runs TaskMap launched, by run id. Only these processes can be stopped.
#[derive(Default)]
pub(crate) struct WorkflowRuns {
    next_id: AtomicU64,
    runs: Mutex<HashMap<String, Run>>,
}

fn status_of(run_id: &str, run: &Run) -> ServiceResult<RunStatus> {
    let mut state = run.state.lock().map_err(|_| ServiceFailure::Internal)?;
    let mut alive = false;
    for process in &mut state.processes {
        alive |= process.exit_code()?.is_none();
    }
    let phase = if state.stopped {
        RunPhase::Stopped
    } else if alive || state.working_lines > 0 {
        RunPhase::Running
    } else if state.failed_line.is_some() {
        RunPhase::Failed
    } else {
        RunPhase::Finished
    };
    Ok(RunStatus {
        run_id: run_id.to_string(),
        phase,
        line_count: run.line_count,
        failed_line: state.failed_line,
    })
}

fn finish_line(state: &Mutex<RunState>, failed: Option<usize>) {
    if let Ok(mut state) = state.lock() {
        state.working_lines -= 1;
        if let Some(index) = failed {
            state.failed_line.get_or_insert(index);
        }
    }
}

/// Runs one line's invocations in order; each waits for the previous one to exit successfully.
fn run_line(index: usize, line: WorkflowLine, stop: Arc<AtomicBool>, state: Arc<Mutex<RunState>>) {
    let last = line.invocations.len() - 1;
    for (position, invocation) in line.invocations.iter().enumerate() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let succeeded = match invocation {
            Invocation::Open { target } => {
                open_target(target, line.working_directory.as_deref()).is_ok()
            }
            Invocation::Run {
                executable,
                arguments,
            } => launch_and_follow(
                executable,
                arguments,
                &line,
                position == last,
                &stop,
                &state,
            ),
        };
        if !succeeded {
            let failed = (!stop.load(Ordering::SeqCst)).then_some(index);
            return finish_line(&state, failed);
        }
    }
    finish_line(&state, None);
}

/// Starts a run invocation; unless it is the line's last, waits for it to exit successfully.
fn launch_and_follow(
    executable: &str,
    arguments: &[String],
    line: &WorkflowLine,
    last: bool,
    stop: &AtomicBool,
    state: &Mutex<RunState>,
) -> bool {
    let Ok(process) = OwnedProcess::launch(
        executable,
        arguments,
        line.working_directory.as_deref(),
        line.display,
    ) else {
        return false;
    };
    let Ok(mut guard) = state.lock() else {
        return false;
    };
    guard.processes.push(process);
    let slot = guard.processes.len() - 1;
    // A stop that set the flag before this push terminated only the earlier processes.
    if stop.load(Ordering::SeqCst) {
        let _ = guard.processes[slot].stop();
        return false;
    }
    drop(guard);
    if last {
        return true;
    }
    loop {
        if stop.load(Ordering::SeqCst) {
            return false;
        }
        let Ok(mut guard) = state.lock() else {
            return false;
        };
        match guard.processes[slot].exit_code() {
            Ok(None) => {}
            Ok(Some(0)) => return true,
            _ => return false,
        }
        drop(guard);
        std::thread::sleep(WAIT_POLL);
    }
}

impl WorkflowRuns {
    /// Starts every line of a validated, trusted definition and returns the first status.
    pub(crate) fn start(
        &self,
        database_id: &str,
        lines: Vec<WorkflowLine>,
    ) -> ServiceResult<RunStatus> {
        let run_id = format!(
            "workflow-run-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed) + 1
        );
        let stop = Arc::new(AtomicBool::new(false));
        let state = Arc::new(Mutex::new(RunState {
            failed_line: None,
            stopped: false,
            working_lines: lines.len(),
            processes: Vec::new(),
        }));
        let mut runs = self.runs.lock().map_err(|_| ServiceFailure::Internal)?;
        self.forget_finished(&mut runs)?;
        runs.insert(
            run_id.clone(),
            Run {
                database_id: database_id.to_string(),
                line_count: lines.len(),
                stop_requested: stop.clone(),
                state: state.clone(),
            },
        );
        drop(runs);
        for (index, line) in lines.into_iter().enumerate() {
            let (line_stop, line_state) = (stop.clone(), state.clone());
            let spawned = std::thread::Builder::new()
                .name("taskmap-workflow".into())
                .spawn(move || run_line(index, line, line_stop, line_state));
            if spawned.is_err() {
                finish_line(&state, Some(index));
            }
        }
        self.status(database_id, &run_id)
    }

    pub(crate) fn status(&self, database_id: &str, run_id: &str) -> ServiceResult<RunStatus> {
        let runs = self.runs.lock().map_err(|_| ServiceFailure::Internal)?;
        let run = runs
            .get(run_id)
            .filter(|run| run.database_id == database_id)
            .ok_or(ServiceFailure::InvalidInput)?;
        status_of(run_id, run)
    }

    /// Stops the run's remaining invocations and ends every process tree it launched.
    pub(crate) fn stop(&self, database_id: &str, run_id: &str) -> ServiceResult<RunStatus> {
        let runs = self.runs.lock().map_err(|_| ServiceFailure::Internal)?;
        let run = runs
            .get(run_id)
            .filter(|run| run.database_id == database_id)
            .ok_or(ServiceFailure::InvalidInput)?;
        run.stop_requested.store(true, Ordering::SeqCst);
        {
            let mut state = run.state.lock().map_err(|_| ServiceFailure::Internal)?;
            state.stopped = true;
            for process in &mut state.processes {
                process.stop()?;
            }
        }
        status_of(run_id, run)
    }

    fn forget_finished(&self, runs: &mut HashMap<String, Run>) -> ServiceResult<()> {
        let mut finished = Vec::new();
        for (run_id, run) in runs.iter() {
            if status_of(run_id, run)?.phase != RunPhase::Running {
                finished.push(run_id.clone());
            }
        }
        if finished.len() >= MAX_FINISHED_RUNS {
            // Run ids count up, so the shortest-then-smallest id is the oldest.
            finished.sort_by(|left, right| left.len().cmp(&right.len()).then(left.cmp(right)));
            for run_id in &finished[..=finished.len() - MAX_FINISHED_RUNS] {
                runs.remove(run_id);
            }
        }
        Ok(())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::workflow::workflow_definition::LineDisplay;
    use std::time::Instant;

    fn cmd(script: &str) -> Invocation {
        Invocation::Run {
            executable: "cmd.exe".into(),
            arguments: vec!["/C".into(), script.into()],
        }
    }

    fn line(invocations: Vec<Invocation>) -> WorkflowLine {
        WorkflowLine {
            invocations,
            working_directory: None,
            display: LineDisplay::Background,
        }
    }

    fn wait_until(
        runs: &WorkflowRuns,
        run_id: &str,
        done: impl Fn(&RunStatus) -> bool,
    ) -> RunStatus {
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            let status = runs.status("db", run_id).unwrap();
            if done(&status) || Instant::now() > deadline {
                return status;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    fn live_processes(runs: &WorkflowRuns, run_id: &str) -> usize {
        let map = runs.runs.lock().unwrap();
        let mut state = map[run_id].state.lock().unwrap();
        state
            .processes
            .iter_mut()
            .map(|process| process.exit_code().unwrap())
            .filter(Option::is_none)
            .count()
    }

    fn wait_for_processes(runs: &WorkflowRuns, run_id: &str, count: usize) {
        let deadline = Instant::now() + Duration::from_secs(10);
        while live_processes(runs, run_id) < count && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn runs_a_line_in_order_and_finishes() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start("db", vec![line(vec![cmd("exit 0"), cmd("exit 0")])])
            .unwrap();
        let status = wait_until(&runs, &run.run_id, |status| {
            status.phase != RunPhase::Running
        });
        assert_eq!(status.phase, RunPhase::Finished);
        assert_eq!(status.failed_line, None);
    }

    #[test]
    fn a_failed_invocation_holds_back_the_rest_of_its_line_only() {
        let runs = WorkflowRuns::default();
        let marker = tempfile::tempdir().unwrap();
        let after = marker.path().join("after.txt");
        let write_after = format!("echo x> \"{}\"", after.display());
        let run = runs
            .start(
                "db",
                vec![
                    line(vec![cmd("exit 3"), cmd(&write_after)]),
                    line(vec![cmd("exit 0")]),
                ],
            )
            .unwrap();
        let status = wait_until(&runs, &run.run_id, |status| {
            status.phase != RunPhase::Running
        });
        assert_eq!(status.phase, RunPhase::Failed);
        assert_eq!(status.failed_line, Some(0));
        assert!(!after.exists());
    }

    #[test]
    fn lines_start_together() {
        let runs = WorkflowRuns::default();
        let long = || line(vec![cmd("ping -n 30 127.0.0.1 >NUL")]);
        let run = runs.start("db", vec![long(), long()]).unwrap();
        wait_for_processes(&runs, &run.run_id, 2);
        assert_eq!(live_processes(&runs, &run.run_id), 2);
        runs.stop("db", &run.run_id).unwrap();
    }

    #[test]
    fn stopping_ends_the_launched_process_trees_and_later_invocations() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start(
                "db",
                vec![line(vec![cmd("ping -n 30 127.0.0.1 >NUL"), cmd("exit 0")])],
            )
            .unwrap();
        wait_for_processes(&runs, &run.run_id, 1);
        assert_eq!(
            runs.stop("db", &run.run_id).unwrap().phase,
            RunPhase::Stopped
        );
        std::thread::sleep(Duration::from_millis(300));
        assert_eq!(live_processes(&runs, &run.run_id), 0);
        let map = runs.runs.lock().unwrap();
        assert_eq!(map[&run.run_id].state.lock().unwrap().processes.len(), 1);
    }

    #[test]
    fn reports_a_program_that_cannot_be_found() {
        let runs = WorkflowRuns::default();
        let missing = Invocation::Run {
            executable: "taskmap-no-such-program-7f3a".into(),
            arguments: vec![],
        };
        let run = runs.start("db", vec![line(vec![missing])]).unwrap();
        let status = wait_until(&runs, &run.run_id, |status| {
            status.phase != RunPhase::Running
        });
        assert_eq!(status.phase, RunPhase::Failed);
        assert_eq!(status.failed_line, Some(0));
    }

    #[test]
    fn hides_runs_of_other_databases() {
        let runs = WorkflowRuns::default();
        let run = runs.start("db", vec![line(vec![cmd("exit 0")])]).unwrap();
        assert!(runs.status("other", &run.run_id).is_err());
        assert!(runs.stop("other", &run.run_id).is_err());
    }
}
