//! Starting TaskMap when the user signs in to Windows: one value under the user's Run key, named
//! after the edition's product name, so stable TaskMap and TaskMap Beta keep separate entries.
//! The `launchAtLogin` and `launchToTray` device preferences decide it; startup and every
//! preference save bring the entry in line with them.

use tauri::AppHandle;

/// Passed by the Run entry when TaskMap should start locked in the tray, without its window.
pub(crate) const TRAY_LAUNCH_ARGUMENT: &str = "--tray";

/// This process was started to sit in the tray (sign-in with "Start in the tray").
pub(crate) fn launched_to_tray() -> bool {
    std::env::args().any(|argument| argument == TRAY_LAUNCH_ARGUMENT)
}

/// The command line the Run entry starts: the executable, quoted, and the tray flag if wanted.
fn run_command(executable: &std::path::Path, to_tray: bool) -> String {
    let flag = if to_tray {
        format!(" {TRAY_LAUNCH_ARGUMENT}")
    } else {
        String::new()
    };
    format!("\"{}\"{flag}", executable.display())
}

/// Adds, updates or removes this edition's Run entry. Best effort: a failure only means TaskMap
/// does not start at sign-in, so it is logged rather than surfaced.
pub(crate) fn apply(app: &AppHandle, enabled: bool, to_tray: bool) {
    // A development build would register its target-folder binary to start at every sign-in.
    if cfg!(debug_assertions) {
        return;
    }
    let name = app.package_info().name.clone();
    let result = if enabled {
        std::env::current_exe()
            .map_err(|error| error.to_string())
            .and_then(|executable| run_key::set(&name, &run_command(&executable, to_tray)))
    } else {
        run_key::remove(&name)
    };
    if let Err(error) = result {
        eprintln!("Could not update starting with Windows: {error}");
    }
}

#[cfg(windows)]
mod run_key {
    use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_SET_VALUE, REG_SZ,
    };

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn with_run_key<T>(action: impl FnOnce(HKEY) -> Result<T, String>) -> Result<T, String> {
        let path = wide(RUN_KEY);
        let mut key: HKEY = std::ptr::null_mut();
        // SAFETY: the path is NUL-terminated and `key` receives a handle closed below.
        let status =
            unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, path.as_ptr(), 0, KEY_SET_VALUE, &mut key) };
        if status != ERROR_SUCCESS {
            return Err(format!("opening the Run key failed ({status})"));
        }
        let result = action(key);
        // SAFETY: `key` was opened above and is not used afterwards.
        unsafe { RegCloseKey(key) };
        result
    }

    pub(super) fn set(name: &str, command: &str) -> Result<(), String> {
        with_run_key(|key| {
            let name = wide(name);
            let data = wide(command);
            let bytes = u32::try_from(data.len() * 2).map_err(|_| "command too long")?;
            // SAFETY: both strings are NUL-terminated and `bytes` is the data's length in bytes.
            let status = unsafe {
                RegSetValueExW(key, name.as_ptr(), 0, REG_SZ, data.as_ptr().cast(), bytes)
            };
            if status == ERROR_SUCCESS {
                Ok(())
            } else {
                Err(format!("writing the Run entry failed ({status})"))
            }
        })
    }

    pub(super) fn remove(name: &str) -> Result<(), String> {
        with_run_key(|key| {
            let name = wide(name);
            // SAFETY: the name is NUL-terminated.
            let status = unsafe { RegDeleteValueW(key, name.as_ptr()) };
            if status == ERROR_SUCCESS || status == ERROR_FILE_NOT_FOUND {
                Ok(())
            } else {
                Err(format!("removing the Run entry failed ({status})"))
            }
        })
    }
}

#[cfg(not(windows))]
mod run_key {
    pub(super) fn set(_name: &str, _command: &str) -> Result<(), String> {
        Ok(())
    }

    pub(super) fn remove(_name: &str) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::run_command;

    #[test]
    fn the_run_entry_quotes_the_executable_and_adds_the_tray_flag_only_when_asked() {
        let executable = std::path::Path::new(r"C:\Program Files\TaskMap\TaskMap.exe");
        assert_eq!(
            run_command(executable, false),
            r#""C:\Program Files\TaskMap\TaskMap.exe""#
        );
        assert_eq!(
            run_command(executable, true),
            r#""C:\Program Files\TaskMap\TaskMap.exe" --tray"#
        );
    }
}
