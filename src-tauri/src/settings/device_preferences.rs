use super::settings_file;
use crate::error::{ServiceFailure, ServiceResult};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

static WRITER: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ElementColors {
    pub container: String,
    pub text_card: String,
    pub text_block: String,
    pub image: String,
    pub mindmap: String,
}
/// Corner radii of the workspace chrome in whole pixels (Settings → Visual → Interface).
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub(crate) struct ChromeRadii {
    pub side_panel: u8,
    pub canvas_card: u8,
    pub extension_card: u8,
    pub quick_extensions: u8,
    pub quick_extensions_card: u8,
    pub chrome: u8,
    pub settings: u8,
    pub settings_island: u8,
}
impl Default for ChromeRadii {
    fn default() -> Self {
        Self {
            side_panel: 19,
            canvas_card: 13,
            extension_card: 10,
            quick_extensions: 17,
            quick_extensions_card: 11,
            chrome: 14,
            settings: 12,
            settings_island: 8,
        }
    }
}
pub(crate) const MAX_CHROME_RADIUS: u8 = 32;
fn default_chrome_auto_hide_delay_ms() -> u32 {
    3000
}
fn default_smooth_zoom_enabled() -> bool {
    true
}
fn default_smooth_zoom_speed_percent() -> u16 {
    115
}
fn launch_at_login_in_older_files() -> bool {
    true
}
/// The shipped canvas colour, `--taskmap-canvas-bg` in the theme.
fn default_canvas_background_color() -> String {
    "#0F1011".to_string()
}
/// Every button the toolbar can show; the ids match `TOOLBAR_BUTTON_IDS` in TypeScript.
const TOOLBAR_BUTTON_IDS: [&str; 11] = [
    "canvases",
    "extensions",
    "settings",
    "privacy",
    "calendar",
    "sleep",
    "minimap",
    "notifications",
    "placeholder-1",
    "placeholder-2",
    "placeholder-3",
];
const TOOLBAR_SLOT_COUNT: usize = 6;
/// Nothing else opens Settings, so it can never leave the toolbar.
const PINNED_TOOLBAR_BUTTON: &str = "settings";
fn default_toolbar_buttons() -> Vec<String> {
    [
        "canvases",
        "extensions",
        "settings",
        "privacy",
        "calendar",
        "sleep",
    ]
    .iter()
    .map(|id| id.to_string())
    .collect()
}
fn valid_toolbar_buttons(buttons: &[String]) -> bool {
    (1..=TOOLBAR_SLOT_COUNT).contains(&buttons.len())
        && buttons.iter().any(|id| id == PINNED_TOOLBAR_BUTTON)
        && buttons.iter().enumerate().all(|(index, id)| {
            TOOLBAR_BUTTON_IDS.contains(&id.as_str()) && !buttons[..index].contains(id)
        })
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DevicePreferences {
    pub default_element_colors: ElementColors,
    pub recent_colors: Vec<String>,
    pub toolbar_buttons_visible: bool,
    pub privacy_mode_enabled: bool,
    /// Sleep mode: workspace chrome hides after inactivity. Absent in older files; defaults off.
    #[serde(default)]
    pub chrome_auto_hide_enabled: bool,
    /// Sleep mode idle delay in milliseconds (1–15 s). Absent in older files; defaults to 3 s.
    #[serde(default = "default_chrome_auto_hide_delay_ms")]
    pub chrome_auto_hide_delay_ms: u32,
    /// Absent in older files; defaults to the shipped radii.
    #[serde(default)]
    pub chrome_radii: ChromeRadii,
    pub dismissed_update_version: Option<String>,
    /// TaskMap starts when the user signs in to Windows. Off for new installs; files from before
    /// the setting existed keep it on, as those installs always started at sign-in.
    #[serde(default = "launch_at_login_in_older_files")]
    pub launch_at_login: bool,
    /// Started at sign-in, TaskMap stays locked in the tray instead of opening its window.
    #[serde(default)]
    pub launch_to_tray: bool,
    /// Background colour of every canvas. Absent in older files; defaults to the shipped colour.
    #[serde(default = "default_canvas_background_color")]
    pub canvas_background_color: String,
    /// The toolbar's buttons, in order. Absent in older files; defaults to the shipped toolbar.
    #[serde(default = "default_toolbar_buttons")]
    pub toolbar_buttons: Vec<String>,
    /// The calendar island beside the toolbar is shown. Absent in older files; defaults to hidden.
    #[serde(default)]
    pub calendar_visible: bool,
    /// An expanded calendar stays open; only its chevron and sleep mode collapse it.
    #[serde(default)]
    pub calendar_stays_open: bool,
    /// A Canvas Browser closed by the user stays closed after unlocking and restarting.
    #[serde(default)]
    pub canvas_browser_remembers_closed: bool,
    /// The user last closed the Canvas Browser; read only while it is remembered.
    #[serde(default)]
    pub canvas_browser_closed: bool,
    /// Wheel zoom glides between steps instead of jumping. Absent in older files; defaults on.
    #[serde(default = "default_smooth_zoom_enabled")]
    pub smooth_zoom_enabled: bool,
    /// How fast smooth zoom glides, in percent (50-200). Absent in older files; defaults to 115.
    #[serde(default = "default_smooth_zoom_speed_percent")]
    pub smooth_zoom_speed_percent: u16,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PreferencesState {
    pub version: u32,
    pub edition: String,
    pub revision: u64,
    pub preferences: DevicePreferences,
}
impl Default for DevicePreferences {
    fn default() -> Self {
        let color = "#476FA8".to_string();
        Self {
            default_element_colors: ElementColors {
                container: color.clone(),
                text_card: color.clone(),
                text_block: color.clone(),
                image: color.clone(),
                mindmap: color,
            },
            recent_colors: vec![],
            toolbar_buttons_visible: true,
            privacy_mode_enabled: false,
            chrome_auto_hide_enabled: false,
            chrome_auto_hide_delay_ms: default_chrome_auto_hide_delay_ms(),
            chrome_radii: ChromeRadii::default(),
            dismissed_update_version: None,
            launch_at_login: false,
            launch_to_tray: false,
            canvas_background_color: default_canvas_background_color(),
            toolbar_buttons: default_toolbar_buttons(),
            calendar_visible: false,
            calendar_stays_open: false,
            canvas_browser_remembers_closed: false,
            canvas_browser_closed: false,
            smooth_zoom_enabled: default_smooth_zoom_enabled(),
            smooth_zoom_speed_percent: default_smooth_zoom_speed_percent(),
        }
    }
}
impl DevicePreferences {
    pub fn validate(&self) -> ServiceResult<()> {
        let c = &self.default_element_colors;
        let valid_color = |s: &String| {
            s.len() == 7
                && s.starts_with('#')
                && s.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
        };
        if [
            &c.container,
            &c.text_card,
            &c.text_block,
            &c.image,
            &c.mindmap,
        ]
        .into_iter()
        .any(|s| !valid_color(s))
            || self.recent_colors.len() > 8
            || !(1000..=15000).contains(&self.chrome_auto_hide_delay_ms)
            || !(50..=200).contains(&self.smooth_zoom_speed_percent)
            || [
                self.chrome_radii.side_panel,
                self.chrome_radii.canvas_card,
                self.chrome_radii.extension_card,
                self.chrome_radii.quick_extensions,
                self.chrome_radii.quick_extensions_card,
                self.chrome_radii.chrome,
                self.chrome_radii.settings,
                self.chrome_radii.settings_island,
            ]
            .into_iter()
            .any(|radius| radius > MAX_CHROME_RADIUS)
            || self.recent_colors.iter().any(|s| !valid_color(s))
            || !valid_color(&self.canvas_background_color)
            || !valid_toolbar_buttons(&self.toolbar_buttons)
            || self
                .dismissed_update_version
                .as_ref()
                .is_some_and(|s| s.is_empty() || s.len() > 128 || s.chars().any(char::is_control))
        {
            return Err(ServiceFailure::InvalidInput);
        }
        Ok(())
    }
}
pub(crate) fn load(directory: &Path, edition: &str) -> ServiceResult<PreferencesState> {
    if !matches!(edition, "stable" | "development") {
        return Err(ServiceFailure::PermissionDenied);
    }
    let path = directory.join(PREFERENCES_FILE);
    let defaults = || PreferencesState {
        version: 1,
        edition: edition.to_string(),
        revision: 0,
        preferences: DevicePreferences::default(),
    };
    let Some(bytes) = settings_file::read(&path, 16 * 1024)? else {
        return Ok(defaults());
    };
    match serde_json::from_slice::<PreferencesState>(&bytes) {
        // Another edition's file in this folder is an isolation failure, not a broken file.
        Ok(state) if state.edition != edition => Err(ServiceFailure::Settings),
        Ok(state)
            if state.version == 1
                && state.revision <= 9_007_199_254_740_991
                && state.preferences.validate().is_ok() =>
        {
            Ok(state)
        }
        // Unreadable, invalid or from an unknown file version: keep a copy and continue with
        // defaults, so a bad settings file never blocks TaskMap (the next save replaces it).
        _ => {
            set_aside(&path);
            Ok(defaults())
        }
    }
}

const PREFERENCES_FILE: &str = "device-preferences-v1.json";

fn set_aside(path: &Path) {
    let backup = path.with_extension("json.bak");
    let _ = std::fs::remove_file(&backup);
    let _ = std::fs::rename(path, backup);
}
pub(crate) fn save(
    directory: &Path,
    edition: &str,
    expected_revision: u64,
    preferences: DevicePreferences,
) -> ServiceResult<PreferencesState> {
    preferences.validate()?;
    let _guard = WRITER.lock().map_err(|_| ServiceFailure::Internal)?;
    let mut state = load(directory, edition)?;
    if state.revision != expected_revision {
        return Err(ServiceFailure::RevisionConflict);
    }
    if state.preferences == preferences {
        return Ok(state);
    }
    if state.revision >= 9_007_199_254_740_991 {
        return Err(ServiceFailure::Settings);
    }
    state.revision += 1;
    state.preferences = preferences;
    settings_file::write(
        &directory.join(PREFERENCES_FILE),
        &serde_json::to_vec(&state).map_err(|_| ServiceFailure::Settings)?,
    )?;
    Ok(state)
}

#[cfg(test)]
#[path = "device_preferences_tests.rs"]
mod tests;
