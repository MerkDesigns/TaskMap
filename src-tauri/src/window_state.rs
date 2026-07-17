use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    Ok(data_dir.join("window-state.json"))
}

fn load_window_state(app: &tauri::AppHandle) -> Result<Option<WindowState>, String> {
    let path = window_state_path(app)?;
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents)
            .map(Some)
            .map_err(|error| format!("Stored window state is invalid: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read window state: {error}")),
    }
}

pub(crate) fn restore_window_state(window: &tauri::WebviewWindow) -> Result<(), String> {
    let Some(state) = load_window_state(window.app_handle())? else {
        return Ok(());
    };

    if state.maximized {
        window.maximize().map_err(|error| error.to_string())?;
        return Ok(());
    }

    // Clamp the saved geometry so the window can never restore off-screen or
    // smaller than usable, for example after disconnecting a monitor.
    let (mut x, mut y, mut width, mut height) = (state.x, state.y, state.width, state.height);

    const MIN_WIDTH: u32 = 960;
    const MIN_HEIGHT: u32 = 640;
    width = width.max(MIN_WIDTH);
    height = height.max(MIN_HEIGHT);

    let monitors = window.available_monitors().unwrap_or_default();
    let contains = |monitor: &tauri::window::Monitor| {
        let position = monitor.position();
        let size = monitor.size();
        x >= position.x
            && y >= position.y
            && x < position.x + size.width as i32
            && y < position.y + size.height as i32
    };
    let target = monitors
        .iter()
        .find(|monitor| contains(monitor))
        .cloned()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(monitor) = target {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        width = width.min(monitor_size.width);
        height = height.min(monitor_size.height);
        let max_x = monitor_position.x + monitor_size.width as i32 - width as i32;
        let max_y = monitor_position.y + monitor_size.height as i32 - height as i32;
        x = x.clamp(monitor_position.x, max_x.max(monitor_position.x));
        y = y.clamp(monitor_position.y, max_y.max(monitor_position.y));
    }

    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub(crate) fn save_window_state(window: &tauri::Window) -> Result<(), String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: window.is_maximized().map_err(|error| error.to_string())?,
    };
    let payload = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;

    fs::write(window_state_path(window.app_handle())?, payload)
        .map_err(|error| format!("Could not save window state: {error}"))
}
