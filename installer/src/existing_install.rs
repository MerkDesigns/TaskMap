//! Finds a TaskMap installation from the uninstall entry the NSIS installer writes.

use std::path::{Path, PathBuf};

use serde::Serialize;
use windows::core::HSTRING;
use windows::Win32::System::Registry::{
    RegGetValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingInstall {
    pub version: String,
    pub location: PathBuf,
    pub executable: PathBuf,
}

/// The refactored TaskMap releases as 1.0.0 or later; every earlier "TaskMap" is the legacy app,
/// whose data format the new app cannot open.
const FIRST_NEW_ARCHITECTURE_RELEASE: [u32; 3] = [1, 0, 0];

impl ExistingInstall {
    pub fn is_legacy(&self) -> bool {
        version_parts(&self.version) < FIRST_NEW_ARCHITECTURE_RELEASE
    }
}

/// Dotted numeric versions; missing or non-numeric parts count as 0.
fn version_parts(version: &str) -> [u32; 3] {
    let mut parts = version
        .split('.')
        .map(|part| part.trim().parse().unwrap_or(0));
    [(); 3].map(|_| parts.next().unwrap_or(0))
}

/// Per-user installs live under HKCU; an older per-machine install would be under HKLM.
pub fn find(product_name: &str) -> Option<ExistingInstall> {
    let key = format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{product_name}");
    [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]
        .into_iter()
        .find_map(|root| {
            // NSIS wraps some values in quotes, InstallLocation among them.
            let read = |name: &str| {
                read_string(root, &key, name).map(|value| value.trim_matches('"').to_owned())
            };
            let location = PathBuf::from(read("InstallLocation")?);
            let binary = read("MainBinaryName").unwrap_or_else(|| product_name.to_owned());
            Some(ExistingInstall {
                version: read("DisplayVersion").unwrap_or_default(),
                executable: executable_path(&location, &binary),
                location,
            })
        })
}

/// NSIS records the main binary name with or without its extension depending on the template.
fn executable_path(location: &Path, main_binary_name: &str) -> PathBuf {
    if main_binary_name.to_ascii_lowercase().ends_with(".exe") {
        location.join(main_binary_name)
    } else {
        location.join(format!("{main_binary_name}.exe"))
    }
}

fn read_string(root: HKEY, key: &str, name: &str) -> Option<String> {
    let key = HSTRING::from(key);
    let name = HSTRING::from(name);
    let mut size = 0u32;
    // SAFETY: a null data pointer asks only for the required size in bytes.
    unsafe {
        RegGetValueW(
            root,
            &key,
            &name,
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut size),
        )
    }
    .ok()
    .ok()?;
    let mut buffer = vec![0u16; (size as usize).div_ceil(2)];
    // SAFETY: `buffer` holds `size` bytes, which RegGetValueW fills with a NUL-terminated string.
    unsafe {
        RegGetValueW(
            root,
            &key,
            &name,
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut size),
        )
    }
    .ok()
    .ok()?;
    let length = buffer
        .iter()
        .position(|&unit| unit == 0)
        .unwrap_or(buffer.len());
    let value = String::from_utf16_lossy(&buffer[..length]);
    (!value.is_empty()).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_before_the_new_architecture_release_are_legacy() {
        let install = |version: &str| ExistingInstall {
            version: version.to_owned(),
            location: PathBuf::new(),
            executable: PathBuf::new(),
        };
        assert!(install("0.3.4").is_legacy());
        assert!(install("0.9.12").is_legacy());
        assert!(install("").is_legacy());
        assert!(!install("1.0.0").is_legacy());
        assert!(!install("1.2").is_legacy());
    }

    #[test]
    fn executable_path_adds_the_extension_only_when_missing() {
        let location = Path::new(r"C:\Apps\TaskMap");
        assert_eq!(
            executable_path(location, "TaskMap"),
            location.join("TaskMap.exe")
        );
        assert_eq!(
            executable_path(location, "TaskMap.exe"),
            location.join("TaskMap.exe")
        );
        assert_eq!(
            executable_path(location, "TaskMap.EXE"),
            location.join("TaskMap.EXE")
        );
    }
}
