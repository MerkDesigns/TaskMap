//! The tray icon shown while TaskMap runs. Closing the window locks the database and leaves
//! TaskMap in the tray (SECURITY.md "Close window"), as does starting at sign-in in the tray; the
//! icon offers Open, which shows the window at the unlock screen, and Quit.

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::database_window_commands::{destroy_session_keeper, reopen_main_window};
use crate::session::database_session::DatabaseSessionState;

/// Asks the main window to save, clear plaintext and quit through its session controller.
pub(crate) const QUIT_REQUESTED_EVENT: &str = "taskmap-quit-requested";

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
    if let Some(icon) = tray_icon().or_else(|| app.default_window_icon().cloned()) {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

/// The monochrome TaskMap icon, which sits with the other tray icons instead of the coloured app
/// icon. Compiled in, so it needs no resource lookup at runtime.
const TRAY_ICON_PNG: &[u8] = include_bytes!("../../Assets/TaskMap_App_Icon_BW.png");

fn tray_icon() -> Option<Image<'static>> {
    let decoded = image::load_from_memory_with_format(TRAY_ICON_PNG, image::ImageFormat::Png)
        .ok()?
        .into_rgba8();
    let (width, height) = decoded.dimensions();
    Some(Image::new_owned(decoded.into_raw(), width, height))
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

#[cfg(test)]
mod tests {
    use super::tray_icon;

    #[test]
    fn the_tray_uses_the_monochrome_icon() {
        let icon = tray_icon().expect("the compiled-in tray icon decodes");
        assert_eq!((icon.width(), icon.height()), (256, 256));
        assert!(icon
            .rgba()
            .as_chunks::<4>()
            .0
            .iter()
            .all(|[red, green, blue, _]| red == green && green == blue));
    }
}
