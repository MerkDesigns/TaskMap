use crate::error::CommandResult;
use discord_rich_presence::activity::{Activity, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use std::sync::{Arc, Mutex};

const DISCORD_CLIENT_ID: &str = "1513214503297486898";

/// Holds the live Discord IPC connection. `None` when RPC is disabled or
/// Discord is not running. The session start time is fixed for the whole
/// app run so the presence shows total time spent in the application.
///
/// `desired` is the last enabled/disabled state the UI asked for. Slow Discord
/// IPC work runs on one background worker, and repeated updates are coalesced
/// so rapid toggling only reconciles the latest requested state.
pub(crate) struct DiscordRpc {
    inner: Arc<Mutex<DiscordRpcInner>>,
    started_at: i64,
}

struct DiscordRpcInner {
    client: Option<DiscordIpcClient>,
    desired: bool,
    canvas_name: Option<String>,
    reconciling: bool,
    dirty: bool,
}

impl DiscordRpc {
    pub(crate) fn new(started_at: i64) -> Self {
        Self {
            inner: Arc::new(Mutex::new(DiscordRpcInner {
                client: None,
                desired: false,
                canvas_name: None,
                reconciling: false,
                dirty: false,
            })),
            started_at,
        }
    }
}

/// Enable or disable Discord Rich Presence. Connecting is best-effort: if
/// Discord is not running the call still succeeds so the app keeps working.
/// Rapid updates are coalesced by one background reconciliation worker.
#[tauri::command]
pub(crate) fn set_discord_rpc(
    enabled: bool,
    canvas_name: Option<String>,
    rpc: tauri::State<'_, DiscordRpc>,
) -> CommandResult<()> {
    let should_spawn = {
        let mut inner = lock_discord_rpc(&rpc.inner);
        inner.desired = enabled;
        inner.canvas_name = canvas_name;

        if inner.reconciling {
            inner.dirty = true;
            false
        } else {
            inner.reconciling = true;
            inner.dirty = false;
            true
        }
    };

    if should_spawn {
        let inner = Arc::clone(&rpc.inner);
        let started_at = rpc.started_at;
        std::thread::spawn(move || reconcile_discord_rpc_worker(inner, started_at));
    }

    Ok(())
}

fn reconcile_discord_rpc_worker(inner: Arc<Mutex<DiscordRpcInner>>, started_at: i64) {
    loop {
        let (enabled, canvas_name, client) = {
            let mut state = lock_discord_rpc(&inner);
            state.dirty = false;
            (
                state.desired,
                state.canvas_name.clone(),
                state.client.take(),
            )
        };

        let client = reconcile_discord_rpc(client, enabled, canvas_name, started_at);

        let mut state = lock_discord_rpc(&inner);
        state.client = client;

        if state.dirty {
            continue;
        }

        state.reconciling = false;
        break;
    }
}

fn reconcile_discord_rpc(
    client: Option<DiscordIpcClient>,
    enabled: bool,
    canvas_name: Option<String>,
    started_at: i64,
) -> Option<DiscordIpcClient> {
    if !enabled {
        if let Some(mut client) = client {
            let _ = catch_ipc(move || {
                let _ = client.clear_activity();
                let _ = client.close();
            });
        }
        return None;
    }

    let mut client = match client {
        Some(client) => client,
        None => {
            let connected = catch_ipc(|| {
                let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
                client.connect().map_err(|error| error.to_string())?;
                Ok::<_, String>(client)
            });

            match connected {
                Ok(Ok(client)) => client,
                Ok(Err(_)) | Err(_) => return None,
            }
        }
    };

    let details = canvas_name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(|name| format!("Working on \"{name}\""));
    let result = catch_ipc(move || {
        let mut activity = Activity::new().timestamps(Timestamps::new().start(started_at));
        if let Some(details) = details.as_deref() {
            activity = activity.details(details);
        }
        client
            .set_activity(activity)
            .map_err(|error| error.to_string())?;
        Ok::<_, String>(client)
    });

    match result {
        Ok(Ok(client)) => Some(client),
        Ok(Err(_)) | Err(_) => None,
    }
}

fn lock_discord_rpc(
    inner: &Arc<Mutex<DiscordRpcInner>>,
) -> std::sync::MutexGuard<'_, DiscordRpcInner> {
    match inner.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

/// Convert a panic from a broken Discord IPC pipe into an error so the app
/// stays alive.
fn catch_ipc<T>(f: impl FnOnce() -> T) -> Result<T, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).map_err(|_| ())
}
