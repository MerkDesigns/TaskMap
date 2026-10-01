use super::settings_file;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

static WRITER: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ElementColors {
    pub container: String,
    pub text_card: String,
    pub text_block: String,
    pub image: String,
    pub mindmap: String,
}
/// Corner radii of the workspace chrome in whole pixels (Settings → Visual → Interface).
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields, default)]
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
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
        }
    }
}
impl DevicePreferences {
    pub fn validate(&self) -> Phase2Result<()> {
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
            || self
                .dismissed_update_version
                .as_ref()
                .is_some_and(|s| s.is_empty() || s.len() > 128 || s.chars().any(char::is_control))
        {
            return Err(Phase2Failure::InvalidInput);
        }
        Ok(())
    }
}
pub(crate) fn load(directory: &Path, edition: &str) -> Phase2Result<PreferencesState> {
    if !matches!(edition, "stable" | "development") {
        return Err(Phase2Failure::PermissionDenied);
    }
    let Some(bytes) =
        settings_file::read(&directory.join("device-preferences-v1.json"), 16 * 1024)?
    else {
        return Ok(PreferencesState {
            version: 1,
            edition: edition.to_string(),
            revision: 0,
            preferences: DevicePreferences::default(),
        });
    };
    let state: PreferencesState =
        serde_json::from_slice(&bytes).map_err(|_| Phase2Failure::Settings)?;
    if state.version != 1 || state.edition != edition || state.revision > 9_007_199_254_740_991 {
        return Err(Phase2Failure::Settings);
    }
    state.preferences.validate()?;
    Ok(state)
}
pub(crate) fn save(
    directory: &Path,
    edition: &str,
    expected_revision: u64,
    preferences: DevicePreferences,
) -> Phase2Result<PreferencesState> {
    preferences.validate()?;
    let _guard = WRITER.lock().map_err(|_| Phase2Failure::Internal)?;
    let mut state = load(directory, edition)?;
    if state.revision != expected_revision {
        return Err(Phase2Failure::RevisionConflict);
    }
    if state.preferences == preferences {
        return Ok(state);
    }
    if state.revision >= 9_007_199_254_740_991 {
        return Err(Phase2Failure::Settings);
    }
    state.revision += 1;
    state.preferences = preferences;
    settings_file::write(
        &directory.join("device-preferences-v1.json"),
        &serde_json::to_vec(&state).map_err(|_| Phase2Failure::Settings)?,
    )?;
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::DevicePreferences;

    #[test]
    fn preference_files_without_sleep_mode_load_with_it_off() {
        let json = r##"{"defaultElementColors":{"container":"#476FA8","textCard":"#476FA8","textBlock":"#476FA8","image":"#476FA8","mindmap":"#476FA8"},"recentColors":[],"toolbarButtonsVisible":true,"privacyModeEnabled":false,"dismissedUpdateVersion":null}"##;
        let preferences: DevicePreferences = serde_json::from_str(json).unwrap();
        assert!(!preferences.chrome_auto_hide_enabled);
        assert_eq!(preferences.chrome_auto_hide_delay_ms, 3000);
        assert_eq!(preferences.chrome_radii, super::ChromeRadii::default());
        assert!(preferences.validate().is_ok());
    }

    #[test]
    fn saved_radii_without_settings_radii_load_with_their_defaults() {
        let radii: super::ChromeRadii = serde_json::from_str(
            r#"{"sidePanel":25,"canvasCard":13,"extensionCard":10,"quickExtensions":17,"quickExtensionsCard":11,"chrome":14}"#,
        )
        .unwrap();
        assert_eq!(radii.side_panel, 25);
        assert_eq!(radii.settings, 12);
        assert_eq!(radii.settings_island, 8);
    }
}
