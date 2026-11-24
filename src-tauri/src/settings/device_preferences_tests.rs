use super::DevicePreferences;

#[test]
fn preference_files_without_sleep_mode_load_with_it_off() {
    let json = r##"{"defaultElementColors":{"container":"#476FA8","textCard":"#476FA8","textBlock":"#476FA8","image":"#476FA8","mindmap":"#476FA8"},"recentColors":[],"toolbarButtonsVisible":true,"privacyModeEnabled":false,"dismissedUpdateVersion":null}"##;
    let preferences: DevicePreferences = serde_json::from_str(json).unwrap();
    assert!(!preferences.chrome_auto_hide_enabled);
    assert_eq!(preferences.chrome_auto_hide_delay_ms, 3000);
    assert_eq!(preferences.chrome_radii, super::ChromeRadii::default());
    assert_eq!(
        preferences.toolbar_buttons,
        super::default_toolbar_buttons()
    );
    assert!(!preferences.calendar_visible);
    assert!(preferences.launch_at_login);
    assert!(!preferences.launch_to_tray);
    assert!(!preferences.calendar_stays_open);
    assert!(!preferences.canvas_browser_remembers_closed);
    assert!(!preferences.canvas_browser_closed);
    assert!(preferences.smooth_zoom_enabled);
    assert_eq!(preferences.smooth_zoom_speed_percent, 115);
    assert!(preferences.validate().is_ok());
}

#[test]
fn new_installs_do_not_start_with_windows() {
    assert!(!DevicePreferences::default().launch_at_login);
}

#[test]
fn toolbar_layouts_keep_settings_and_never_repeat_or_overflow() {
    let layout = |ids: &[&str]| DevicePreferences {
        toolbar_buttons: ids.iter().map(|id| id.to_string()).collect(),
        ..DevicePreferences::default()
    };
    assert!(layout(&["calendar", "settings", "minimap"])
        .validate()
        .is_ok());
    assert!(layout(&["sleep", "settings", "placeholder-2"])
        .validate()
        .is_ok());
    assert!(layout(&["canvases", "minimap"]).validate().is_err());
    assert!(layout(&["settings", "settings"]).validate().is_err());
    assert!(layout(&["settings", "unknown"]).validate().is_err());
    assert!(layout(&[
        "settings",
        "canvases",
        "extensions",
        "privacy",
        "minimap",
        "sleep",
        "placeholder-1"
    ])
    .validate()
    .is_err());
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

#[test]
fn settings_written_by_a_newer_taskmap_still_load() {
    let directory = tempfile::tempdir().unwrap();
    let mut state = serde_json::to_value(super::load(directory.path(), "stable").unwrap()).unwrap();
    state["preferences"]["settingFromTheFuture"] = serde_json::json!(true);
    state["preferences"]["toolbarButtonsVisible"] = serde_json::json!(false);
    std::fs::write(
        directory.path().join(super::PREFERENCES_FILE),
        serde_json::to_vec(&state).unwrap(),
    )
    .unwrap();

    let loaded = super::load(directory.path(), "stable").unwrap();
    assert!(!loaded.preferences.toolbar_buttons_visible);
}

#[test]
fn an_unreadable_settings_file_is_kept_aside_and_defaults_are_used() {
    let directory = tempfile::tempdir().unwrap();
    let file = directory.path().join(super::PREFERENCES_FILE);
    std::fs::write(&file, b"{ not json").unwrap();

    let loaded = super::load(directory.path(), "stable").unwrap();

    assert_eq!(loaded.revision, 0);
    assert_eq!(loaded.preferences, super::DevicePreferences::default());
    assert!(!file.exists());
    assert_eq!(
        std::fs::read(directory.path().join("device-preferences-v1.json.bak")).unwrap(),
        b"{ not json"
    );
}
