//! WTS notifications belong to native window lifetime, including the hidden session keeper.
#[cfg(windows)]
mod windows {
    use crate::session::database_session::DatabaseSessionState;
    use tauri::{Emitter, Manager};
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        System::RemoteDesktop::{
            WTSRegisterSessionNotification, WTSUnRegisterSessionNotification,
            NOTIFY_FOR_THIS_SESSION,
        },
        UI::{
            Shell::{DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{WM_NCDESTROY, WM_WTSSESSION_CHANGE},
        },
    };
    const SUBCLASS_ID: usize = 0x544d4150;
    const SESSION_LOCK: usize = 7;
    struct Owner {
        app: tauri::AppHandle,
    }
    unsafe extern "system" fn receive(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        if message == WM_WTSSESSION_CHANGE && wparam == SESSION_LOCK {
            // Native key/upload/drop revocation precedes notification of the renderer.
            let owner = &*(data as *const Owner);
            let session = owner.app.state::<DatabaseSessionState>();
            if session.has_open_session() {
                if session.lock_for_os_session().is_err() {
                    let _ = session.close_database();
                }
                let _ = owner.app.emit("taskmap-session-revoked", ());
            }
        }
        if message == WM_NCDESTROY {
            WTSUnRegisterSessionNotification(hwnd);
            RemoveWindowSubclass(hwnd, Some(receive), id);
            drop(Box::from_raw(data as *mut Owner));
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }
    pub(super) fn install(window: &tauri::WebviewWindow) -> Result<(), String> {
        let owned = window.clone();
        let (send, receive_result) = std::sync::mpsc::sync_channel(1);
        window
            .run_on_main_thread(move || {
                let result = (|| {
                    let hwnd = owned.hwnd().map_err(|_| "Session window unavailable")?.0 as HWND;
                    // Subclass helpers must execute on the window's owning thread.
                    unsafe {
                        let mut existing = 0;
                        if GetWindowSubclass(hwnd, Some(receive), SUBCLASS_ID, &mut existing) != 0 {
                            return Ok(());
                        }
                        let owner = Box::into_raw(Box::new(Owner {
                            app: owned.app_handle().clone(),
                        }));
                        if SetWindowSubclass(hwnd, Some(receive), SUBCLASS_ID, owner as usize) == 0
                        {
                            drop(Box::from_raw(owner));
                            return Err("Session notification hook unavailable");
                        }
                        if WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) == 0 {
                            RemoveWindowSubclass(hwnd, Some(receive), SUBCLASS_ID);
                            drop(Box::from_raw(owner));
                            return Err("Windows session notifications unavailable");
                        }
                    }
                    Ok(())
                })();
                let _ = send.send(result);
            })
            .map_err(|_| "Could not schedule session protection")?;
        receive_result
            .recv()
            .map_err(|_| "Session protection did not initialize")?
            .map_err(str::to_owned)
    }
}

pub(crate) fn install(window: &tauri::WebviewWindow) -> Result<(), String> {
    if crate::storage_preview::ENABLED || cfg!(feature = "ui-lab-development") {
        return Ok(());
    }
    #[cfg(windows)]
    return windows::install(window);
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(())
    }
}
