use super::workflow_definition::WorkflowStep;
use super::workflow_process::OwnedProcess;
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
    /// Steps are still starting, or a started process is still alive.
    Running,
    /// Every step started and every process has exited.
    Finished,
    /// A step could not start, or a step the next one waited for exited unsuccessfully.
    Failed,
    Stopped,
}

/// What the UI learns about a run: ids, counts and codes, never definitions or output.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunStatus {
    pub run_id: String,
    pub phase: RunPhase,
    pub step_count: usize,
    pub started_steps: usize,
    pub failed_step: Option<usize>,
}

struct RunState {
    started_steps: usize,
    failed_step: Option<usize>,
    stopped: bool,
    launching: bool,
    processes: Vec<OwnedProcess>,
}

struct Run {
    database_id: String,
    step_count: usize,
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
    } else if state.failed_step.is_some() && !alive && !state.launching {
        RunPhase::Failed
    } else if alive || state.launching {
        RunPhase::Running
    } else {
        RunPhase::Finished
    };
    Ok(RunStatus {
        run_id: run_id.to_string(),
        phase,
        step_count: run.step_count,
        started_steps: state.started_steps,
        failed_step: state.failed_step,
    })
}

/// Starts the steps in order on a worker thread; a waiting step holds the next until it exits.
fn launch_steps(steps: Vec<WorkflowStep>, stop: Arc<AtomicBool>, state: Arc<Mutex<RunState>>) {
    let lock = || state.lock().ok();
    'steps: for (index, step) in steps.iter().enumerate() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let process = match OwnedProcess::launch(step) {
            Ok(process) => process,
            Err(_) => {
                if let Some(mut state) = lock() {
                    state.failed_step = Some(index);
                }
                break;
            }
        };
        let Some(mut guard) = lock() else { break };
        guard.processes.push(process);
        guard.started_steps = index + 1;
        // A stop that set the flag before this push terminated only the earlier processes.
        if stop.load(Ordering::SeqCst) {
            if let Some(process) = guard.processes.last_mut() {
                let _ = process.stop();
            }
            break;
        }
        drop(guard);
        if !step.wait_for_exit {
            continue;
        }
        loop {
            if stop.load(Ordering::SeqCst) {
                break 'steps;
            }
            let Some(mut guard) = lock() else {
                break 'steps;
            };
            match guard.processes.last_mut().map(OwnedProcess::exit_code) {
                Some(Ok(None)) => {}
                Some(Ok(Some(0))) => break,
                _ => {
                    guard.failed_step = Some(index);
                    break 'steps;
                }
            }
            drop(guard);
            std::thread::sleep(WAIT_POLL);
        }
    }
    if let Some(mut state) = lock() {
        state.launching = false;
    }
}

impl WorkflowRuns {
    /// Starts a validated, trusted definition for the database and returns its first status.
    pub(crate) fn start(
        &self,
        database_id: &str,
        steps: Vec<WorkflowStep>,
    ) -> ServiceResult<RunStatus> {
        let run_id = format!(
            "workflow-run-{}",
            self.next_id.fetch_add(1, Ordering::Relaxed) + 1
        );
        let run = Run {
            database_id: database_id.to_string(),
            step_count: steps.len(),
            stop_requested: Arc::new(AtomicBool::new(false)),
            state: Arc::new(Mutex::new(RunState {
                started_steps: 0,
                failed_step: None,
                stopped: false,
                launching: true,
                processes: Vec::new(),
            })),
        };
        let (stop, state) = (run.stop_requested.clone(), run.state.clone());
        let mut runs = self.runs.lock().map_err(|_| ServiceFailure::Internal)?;
        self.forget_finished(&mut runs)?;
        runs.insert(run_id.clone(), run);
        drop(runs);
        std::thread::Builder::new()
            .name("taskmap-workflow".into())
            .spawn(move || launch_steps(steps, stop, state))
            .map_err(|_| ServiceFailure::Internal)?;
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

    /// Stops the run's remaining steps and ends every process tree it launched.
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
    use crate::workflow::workflow_definition::StepDisplay;
    use std::time::Instant;

    fn step(arguments: &[&str], wait_for_exit: bool) -> WorkflowStep {
        WorkflowStep {
            executable: "cmd.exe".into(),
            arguments: arguments
                .iter()
                .map(|argument| argument.to_string())
                .collect(),
            working_directory: None,
            display: StepDisplay::Background,
            wait_for_exit,
        }
    }

    fn wait_for(runs: &WorkflowRuns, run_id: &str, phase: RunPhase) -> RunStatus {
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            let status = runs.status("db", run_id).unwrap();
            if status.phase == phase || Instant::now() > deadline {
                return status;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    #[test]
    fn finishes_after_every_step_started_and_exited() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start(
                "db",
                vec![
                    step(&["/C", "exit 0"], true),
                    step(&["/C", "exit 0"], false),
                ],
            )
            .unwrap();
        let status = wait_for(&runs, &run.run_id, RunPhase::Finished);
        assert_eq!(status.phase, RunPhase::Finished);
        assert_eq!(status.started_steps, 2);
        assert_eq!(status.failed_step, None);
    }

    #[test]
    fn a_failed_waited_step_holds_back_the_rest() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start(
                "db",
                vec![
                    step(&["/C", "exit 3"], true),
                    step(&["/C", "exit 0"], false),
                ],
            )
            .unwrap();
        let status = wait_for(&runs, &run.run_id, RunPhase::Failed);
        assert_eq!(status.phase, RunPhase::Failed);
        assert_eq!(status.failed_step, Some(0));
        assert_eq!(status.started_steps, 1);
    }

    #[test]
    fn steps_that_do_not_wait_start_together() {
        let runs = WorkflowRuns::default();
        let long = step(&["/C", "ping -n 30 127.0.0.1 >NUL"], false);
        let run = runs.start("db", vec![long.clone(), long]).unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        while runs.status("db", &run.run_id).unwrap().started_steps < 2 && Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(50));
        }
        assert_eq!(
            runs.status("db", &run.run_id).unwrap().phase,
            RunPhase::Running
        );
        assert_eq!(runs.status("db", &run.run_id).unwrap().started_steps, 2);
        runs.stop("db", &run.run_id).unwrap();
    }

    #[test]
    fn stopping_ends_the_launched_process_trees_and_later_steps() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start(
                "db",
                vec![
                    step(&["/C", "ping -n 30 127.0.0.1 >NUL"], true),
                    step(&["/C", "exit 0"], false),
                ],
            )
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        while runs.status("db", &run.run_id).unwrap().started_steps < 1 && Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(20));
        }
        let stopped = runs.stop("db", &run.run_id).unwrap();
        assert_eq!(stopped.phase, RunPhase::Stopped);
        std::thread::sleep(Duration::from_millis(300));
        let status = runs.status("db", &run.run_id).unwrap();
        assert_eq!(status.phase, RunPhase::Stopped);
        assert_eq!(status.started_steps, 1);
        let state = runs.runs.lock().unwrap();
        let mut run_state = state[&run.run_id].state.lock().unwrap();
        assert!(run_state.processes[0].exit_code().unwrap().is_some());
    }

    #[test]
    fn reports_a_step_that_cannot_start() {
        let runs = WorkflowRuns::default();
        let mut missing = step(&[], false);
        missing.executable = "taskmap-no-such-program-7f3a.exe".into();
        let run = runs.start("db", vec![missing]).unwrap();
        let status = wait_for(&runs, &run.run_id, RunPhase::Failed);
        assert_eq!(status.failed_step, Some(0));
        assert_eq!(status.started_steps, 0);
    }

    #[test]
    fn hides_runs_of_other_databases() {
        let runs = WorkflowRuns::default();
        let run = runs
            .start("db", vec![step(&["/C", "exit 0"], false)])
            .unwrap();
        assert!(runs.status("other", &run.run_id).is_err());
        assert!(runs.stop("other", &run.run_id).is_err());
    }
}
