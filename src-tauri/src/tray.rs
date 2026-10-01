//! The tray icon shown while TaskMap runs. Closing the window to the tray keeps the unlocked
//! session in the background (SECURITY.md "Close window"); the icon makes that visible and offers
//! Open and Quit, and an optional timer locks the session and exits after a set time in the tray.
//!
//! Locking while the window is closed ends the process (the session keeper is destroyed with the
//! key), so the tray offers Quit rather than a separate Lock.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::database_window_commands::{destroy_session_keeper, reopen_main_window};
use crate::session::database_session::DatabaseSessionState;

/// Asks the main window to save, clear plaintext and quit through its session controller.
pub(crate) const QUIT_REQUESTED_EVENT: &str = "taskmap-quit-requested";

/// Every arm or cancel starts a new generation; a sleeping timer fires only if it is still current.
#[derive(Default)]
pub(crate) struct TrayLock {
    generation: AtomicU64,
}

impl TrayLock {
    fn begin(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn is_current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }

    pub(crate) fn cancel(&self) {
        self.begin();
    }
}

pub(crate) fn install(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open TaskMap", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit TaskMap", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = reopen_main_window(app);
            }
            "quit" => request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = reopen_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// With the window open, its renderer owns unsaved edits and quits through the session controller;
/// with the window closed everything is already saved, so the backend quits directly.
pub(crate) fn request_quit(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.emit(QUIT_REQUESTED_EVENT, ()).is_ok() {
            return;
        }
    }
    quit_now(app);
}

pub(crate) fn quit_now(app: &AppHandle) {
    let _ = app.state::<DatabaseSessionState>().quit_session();
    destroy_session_keeper(app);
    app.exit(0);
}

/// Starts the "lock after this long in the tray" timer; 0 minutes only cancels a running one.
pub(crate) fn arm_lock(app: &AppHandle, minutes: u32) {
    let generation = app.state::<TrayLock>().begin();
    if minutes == 0 {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(u64::from(minutes) * 60));
        let still_in_tray = app.state::<TrayLock>().is_current(generation)
            && app.get_webview_window("main").is_none();
        if still_in_tray {
            let session = app.state::<DatabaseSessionState>();
            if session.lock_database().is_err() {
                let _ = session.close_database();
            }
            destroy_session_keeper(&app);
            app.exit(0);
        }
    });
}

pub(crate) fn cancel_lock(app: &AppHandle) {
    app.state::<TrayLock>().cancel();
}

#[cfg(test)]
mod tests {
    use super::TrayLock;

    #[test]
    fn a_timer_fires_only_while_nothing_has_happened_since_it_was_armed() {
        let lock = TrayLock::default();
        let first = lock.begin();
        assert!(lock.is_current(first));

        lock.cancel();
        assert!(!lock.is_current(first));

        let second = lock.begin();
        assert!(lock.is_current(second));
        assert!(!lock.is_current(first));
    }
}
