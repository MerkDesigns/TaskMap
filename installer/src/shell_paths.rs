//! Windows shell locations and shortcut creation, through COM rather than any shell interpreter.

use std::path::{Path, PathBuf};

use windows::core::{Interface, HSTRING};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_LocalAppData, FOLDERID_Programs, IShellLinkW, SHGetKnownFolderPath,
    ShellLink, KF_FLAG_DEFAULT,
};

#[derive(Debug, Clone, Copy)]
pub enum KnownFolder {
    Desktop,
    /// The current user's Start Menu "Programs" folder.
    StartMenuPrograms,
    LocalAppData,
}

pub fn known_folder(folder: KnownFolder) -> Option<PathBuf> {
    let id = match folder {
        KnownFolder::Desktop => &FOLDERID_Desktop,
        KnownFolder::StartMenuPrograms => &FOLDERID_Programs,
        KnownFolder::LocalAppData => &FOLDERID_LocalAppData,
    };
    // SAFETY: SHGetKnownFolderPath returns a CoTaskMem-allocated string that is freed exactly once.
    unsafe {
        let raw = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
        let path = raw.to_string().ok();
        CoTaskMemFree(Some(raw.0 as *const _));
        path.map(PathBuf::from)
    }
}

/// Writes a `.lnk` at `link` that starts `target` in its own folder.
pub fn create_shortcut(link: &Path, target: &Path) -> windows::core::Result<()> {
    // SAFETY: COM is initialized on this thread for the duration of the calls and released after.
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let result = (|| {
            let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            shell_link.SetPath(&HSTRING::from(target.as_os_str()))?;
            if let Some(folder) = target.parent() {
                shell_link.SetWorkingDirectory(&HSTRING::from(folder.as_os_str()))?;
            }
            shell_link.SetIconLocation(&HSTRING::from(target.as_os_str()), 0)?;
            let file: IPersistFile = shell_link.cast()?;
            file.Save(&HSTRING::from(link.as_os_str()), true)
        })();
        if initialized {
            CoUninitialize();
        }
        result
    }
}
