use std::collections::HashSet;

pub(crate) type AppData = serde_json::Value;

pub(crate) const APP_DATA_SCHEMA_VERSION: u64 = 1;
pub(crate) const CANVAS_CONTENT_FIELDS: [&str; 4] =
    ["containers", "textCards", "textBlocks", "images"];
const DEFAULT_CANVAS_WIDTH: u64 = 3000;
const DEFAULT_CANVAS_HEIGHT: u64 = 3000;
const DEFAULT_CONTAINER_ACCENT: &str = "#476FA8";

pub(crate) fn migrate_app_data(mut data: AppData) -> Result<AppData, String> {
    let version = data
        .as_object()
        .ok_or_else(|| "App data must be a JSON object".to_string())?
        .get("schemaVersion")
        .map(|value| {
            value
                .as_u64()
                .ok_or_else(|| "App data schemaVersion must be an integer".to_string())
        })
        .transpose()?;

    match version {
        None | Some(0) => migrate_app_data_v0(&mut data)?,
        Some(APP_DATA_SCHEMA_VERSION) => {}
        Some(version) => {
            return Err(format!(
                "Unsupported app data schema version {version}; this build supports version {APP_DATA_SCHEMA_VERSION}"
            ))
        }
    }

    validate_app_data_v1(&data)?;
    Ok(data)
}

fn default_grid_opacity() -> serde_json::Value {
    serde_json::json!({ "dots": 50, "lines": 15 })
}

fn default_container() -> serde_json::Value {
    serde_json::json!({
        "id": "container-1",
        "name": "Container 1",
        "x": 520,
        "y": 460,
        "width": 380,
        "height": 260,
        "accent": DEFAULT_CONTAINER_ACCENT,
        "extensions": {}
    })
}

fn set_default_if_null(
    object: &mut serde_json::Map<String, serde_json::Value>,
    field: &str,
    default: serde_json::Value,
) {
    if object.get(field).is_none_or(serde_json::Value::is_null) {
        object.insert(field.to_string(), default);
    }
}

fn normalize_v0_element_arrays(canvas: &mut serde_json::Map<String, serde_json::Value>) {
    for field in CANVAS_CONTENT_FIELDS {
        if !canvas.get(field).is_some_and(serde_json::Value::is_array) {
            canvas.insert(field.to_string(), serde_json::Value::Array(Vec::new()));
        }
    }

    for field in CANVAS_CONTENT_FIELDS {
        let Some(elements) = canvas
            .get_mut(field)
            .and_then(serde_json::Value::as_array_mut)
        else {
            continue;
        };
        for (index, element) in elements.iter_mut().enumerate() {
            let Some(object) = element.as_object_mut() else {
                continue;
            };
            set_default_if_null(object, "extensions", serde_json::json!({}));
            if field == "textBlocks" && object.get("name").is_none_or(serde_json::Value::is_null) {
                object.insert(
                    "name".to_string(),
                    serde_json::Value::String(format!("Text block {}", index + 1)),
                );
            }
        }
    }

    if canvas
        .get("previewViewport")
        .is_some_and(serde_json::Value::is_null)
    {
        canvas.remove("previewViewport");
    }
}

fn migrate_app_data_v0(data: &mut AppData) -> Result<(), String> {
    let object = data
        .as_object_mut()
        .ok_or_else(|| "App data must be a JSON object".to_string())?;

    match object.get_mut("canvases") {
        Some(serde_json::Value::Array(canvases)) => {
            if canvases.is_empty() {
                return Err("App data must contain at least one canvas".to_string());
            }
            for canvas in canvases {
                let canvas = canvas
                    .as_object_mut()
                    .ok_or_else(|| "Legacy canvas data must be an object".to_string())?;
                normalize_v0_element_arrays(canvas);
            }
        }
        Some(_) => return Err("App data canvases must be an array".to_string()),
        None => {
            let containers = match object.remove("containers") {
                None | Some(serde_json::Value::Null) => vec![default_container()],
                Some(serde_json::Value::Array(items)) => items,
                Some(_) => return Err("Legacy containers must be an array".to_string()),
            };
            let text_blocks = match object.remove("textBlocks") {
                None | Some(serde_json::Value::Null) => Vec::new(),
                Some(serde_json::Value::Array(items)) => items,
                Some(_) => return Err("Legacy textBlocks must be an array".to_string()),
            };
            let pan = match object.remove("pan") {
                None | Some(serde_json::Value::Null) => serde_json::json!({ "x": -520, "y": -420 }),
                Some(value) => value,
            };
            let zoom = match object.remove("zoom") {
                None | Some(serde_json::Value::Null) => serde_json::json!(1),
                Some(value) => value,
            };
            let mut canvas = serde_json::json!({
                "id": "canvas-1",
                "name": "Canvas 1",
                "width": DEFAULT_CANVAS_WIDTH,
                "height": DEFAULT_CANVAS_HEIGHT,
                "containers": containers,
                "textCards": [],
                "textBlocks": text_blocks,
                "images": [],
                "pan": pan,
                "zoom": zoom
            });
            let canvas_object = canvas
                .as_object_mut()
                .ok_or_else(|| "Failed to construct the default canvas".to_string())?;
            normalize_v0_element_arrays(canvas_object);
            object.insert(
                "canvases".to_string(),
                serde_json::Value::Array(vec![canvas]),
            );
        }
    }

    let first_canvas_id = object
        .get("canvases")
        .and_then(serde_json::Value::as_array)
        .and_then(|canvases| canvases.first())
        .and_then(|canvas| canvas.get("id"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "First canvas must have a non-empty ID".to_string())?
        .to_string();
    let active_is_valid = object
        .get("activeCanvasId")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|active| {
            object
                .get("canvases")
                .and_then(serde_json::Value::as_array)
                .is_some_and(|canvases| {
                    canvases.iter().any(|canvas| {
                        canvas.get("id").and_then(serde_json::Value::as_str) == Some(active)
                    })
                })
        });
    if !active_is_valid {
        object.insert(
            "activeCanvasId".to_string(),
            serde_json::Value::String(first_canvas_id),
        );
    }

    set_default_if_null(object, "canvasGridStyle", serde_json::json!("dots"));
    set_default_if_null(object, "canvasGridOpacity", default_grid_opacity());
    set_default_if_null(object, "discordRpcEnabled", serde_json::json!(false));
    set_default_if_null(object, "discordRpcShowCanvas", serde_json::json!(true));
    set_default_if_null(object, "minimapEnabled", serde_json::json!(true));
    set_default_if_null(object, "privacyModeEnabled", serde_json::json!(false));
    set_default_if_null(object, "toolbarButtonsVisible", serde_json::json!(false));
    if object
        .get("dismissedUpdateVersion")
        .is_some_and(serde_json::Value::is_null)
    {
        object.remove("dismissedUpdateVersion");
    }
    object.insert(
        "schemaVersion".to_string(),
        serde_json::Value::Number(APP_DATA_SCHEMA_VERSION.into()),
    );
    Ok(())
}

fn required_string<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
) -> Result<&'a str, String> {
    object
        .get(field)
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{context}.{field} must be a non-empty string"))
}

fn string_value<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
) -> Result<&'a str, String> {
    object
        .get(field)
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("{context}.{field} must be a string"))
}

fn required_number(
    object: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
    positive: bool,
) -> Result<f64, String> {
    let value = object
        .get(field)
        .and_then(serde_json::Value::as_f64)
        .ok_or_else(|| format!("{context}.{field} must be a finite number"))?;
    if positive && value <= 0.0 {
        return Err(format!("{context}.{field} must be positive"));
    }
    Ok(value)
}

fn optional_number(
    object: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
    positive: bool,
) -> Result<(), String> {
    if object.contains_key(field) {
        required_number(object, field, context, positive)?;
    }
    Ok(())
}

fn optional_string(
    object: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
    non_empty: bool,
) -> Result<(), String> {
    if !object.contains_key(field) {
        return Ok(());
    }
    if non_empty {
        required_string(object, field, context)?;
    } else {
        string_value(object, field, context)?;
    }
    Ok(())
}

fn optional_boolean(
    object: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    context: &str,
) -> Result<(), String> {
    if object.contains_key(field)
        && object
            .get(field)
            .and_then(serde_json::Value::as_bool)
            .is_none()
    {
        return Err(format!("{context}.{field} must be a boolean"));
    }
    Ok(())
}

fn validate_extensions(value: &serde_json::Value, context: &str) -> Result<(), String> {
    let extensions = value
        .as_object()
        .ok_or_else(|| format!("{context} must be an object"))?;

    for field in [
        "privacy",
        "lock",
        "colorPicker",
        "autoCheckbox",
        "counter",
        "inheritCardColor",
        "copyPasteJson",
    ] {
        if let Some(extension) = extensions.get(field) {
            let object = extension
                .as_object()
                .ok_or_else(|| format!("{context}.{field} must be an object"))?;
            if object
                .get("enabled")
                .and_then(serde_json::Value::as_bool)
                .is_none()
            {
                return Err(format!("{context}.{field}.enabled must be a boolean"));
            }
        }
    }

    if let Some(extension) = extensions.get("checkbox") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.checkbox must be an object"))?;
        if object
            .get("checked")
            .and_then(serde_json::Value::as_bool)
            .is_none()
        {
            return Err(format!("{context}.checkbox.checked must be a boolean"));
        }
    }
    if extensions.contains_key("checkbox") && extensions.contains_key("commandRunner") {
        return Err(format!(
            "{context} cannot contain both checkbox and commandRunner"
        ));
    }
    if let Some(extension) = extensions.get("commandRunner") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.commandRunner must be an object"))?;
        let commands = object
            .get("commands")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| format!("{context}.commandRunner.commands must be an array"))?;
        for (index, command) in commands.iter().enumerate() {
            let command_context = format!("{context}.commandRunner.commands[{index}]");
            let command = command
                .as_object()
                .ok_or_else(|| format!("{command_context} must be an object"))?;
            let command_text = command
                .get("command")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| format!("{command_context}.command must be a string"))?;
            if command_text.trim().is_empty() {
                return Err(format!("{command_context}.command must not be empty"));
            }
            optional_string(command, "workingDirectory", &command_context, false)?;
            optional_boolean(command, "runAsAdmin", &command_context)?;
            if !matches!(
                command.get("runMode").and_then(serde_json::Value::as_str),
                Some("terminal" | "background")
            ) {
                return Err(format!(
                    "{command_context}.runMode must be terminal or background"
                ));
            }
        }
    }
    if let Some(extension) = extensions.get("dailyReset") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.dailyReset must be an object"))?;
        string_value(object, "lastResetDate", &format!("{context}.dailyReset"))?;
    }
    if let Some(extension) = extensions.get("pickCard") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.pickCard must be an object"))?;
        optional_string(
            object,
            "selectedCardId",
            &format!("{context}.pickCard"),
            false,
        )?;
        optional_string(object, "lastCardId", &format!("{context}.pickCard"), false)?;
    }
    if let Some(extension) = extensions.get("search") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.search must be an object"))?;
        string_value(object, "query", &format!("{context}.search"))?;
    }
    if let Some(extension) = extensions.get("sorting") {
        let object = extension
            .as_object()
            .ok_or_else(|| format!("{context}.sorting must be an object"))?;
        let mode = object
            .get("mode")
            .ok_or_else(|| format!("{context}.sorting.mode is required"))?;
        if !mode.is_null() && !matches!(mode.as_str(), Some("alphabet" | "color")) {
            return Err(format!(
                "{context}.sorting.mode must be alphabet, color, or null"
            ));
        }
        if !matches!(
            object.get("direction").and_then(serde_json::Value::as_str),
            Some("asc" | "desc")
        ) {
            return Err(format!("{context}.sorting.direction must be asc or desc"));
        }
    }
    Ok(())
}

fn validate_elements(
    canvas: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    canvas_context: &str,
    ids: &mut HashSet<String>,
) -> Result<(), String> {
    let Some(value) = canvas.get(field) else {
        return Ok(());
    };
    let elements = value
        .as_array()
        .ok_or_else(|| format!("{canvas_context}.{field} must be an array"))?;

    for (index, element) in elements.iter().enumerate() {
        let context = format!("{canvas_context}.{field}[{index}]");
        let object = element
            .as_object()
            .ok_or_else(|| format!("{context} must be an object"))?;
        let id = required_string(object, "id", &context)?;
        if !ids.insert(id.to_string()) {
            return Err(format!(
                "{canvas_context} contains duplicate element ID {id}"
            ));
        }

        match field {
            "containers" => {
                string_value(object, "name", &context)?;
                required_string(object, "accent", &context)?;
                required_number(object, "x", &context, false)?;
                required_number(object, "y", &context, false)?;
                required_number(object, "width", &context, true)?;
                required_number(object, "height", &context, true)?;
            }
            "textCards" => {
                object
                    .get("text")
                    .and_then(serde_json::Value::as_str)
                    .ok_or_else(|| format!("{context}.text must be a string"))?;
                required_string(object, "accent", &context)?;
                required_number(object, "x", &context, false)?;
                required_number(object, "y", &context, false)?;
            }
            "textBlocks" => {
                string_value(object, "text", &context)?;
                string_value(object, "name", &context)?;
                required_string(object, "accent", &context)?;
                required_number(object, "x", &context, false)?;
                required_number(object, "y", &context, false)?;
                required_number(object, "width", &context, true)?;
                required_number(object, "height", &context, true)?;
            }
            "images" => {
                required_string(object, "accent", &context)?;
                required_number(object, "x", &context, false)?;
                required_number(object, "y", &context, false)?;
                required_number(object, "width", &context, true)?;
                required_number(object, "height", &context, true)?;
            }
            _ => unreachable!(),
        }

        optional_number(object, "layer", &context, false)?;
        optional_string(object, "containerId", &context, false)?;
        optional_number(object, "order", &context, false)?;
        if field == "containers" || field == "textBlocks" {
            optional_boolean(object, "headerButtonsVisible", &context)?;
        }
        if field == "textCards" {
            optional_string(object, "link", &context, false)?;
        }
        if field == "images" {
            optional_string(object, "imageId", &context, true)?;
            optional_string(object, "format", &context, true)?;
            optional_number(object, "naturalWidth", &context, true)?;
            optional_number(object, "naturalHeight", &context, true)?;
            optional_boolean(object, "background", &context)?;
        }
        if let Some(extensions) = object.get("extensions") {
            validate_extensions(extensions, &format!("{context}.extensions"))?;
        }
    }
    Ok(())
}

pub(crate) fn validate_canvas_content_payload(canvas: &AppData) -> Result<&str, String> {
    let object = canvas
        .as_object()
        .ok_or_else(|| "Canvas content must be an object".to_string())?;
    let id = required_string(object, "id", "canvasContent")?;
    let mut element_ids = HashSet::new();
    for field in CANVAS_CONTENT_FIELDS {
        if !object.contains_key(field) {
            return Err(format!("canvasContent.{field} is required"));
        }
        validate_elements(object, field, "canvasContent", &mut element_ids)?;
    }
    Ok(id)
}

fn validate_canvases(value: &serde_json::Value) -> Result<(), String> {
    let canvases = value
        .as_array()
        .ok_or_else(|| "App data canvases must be an array".to_string())?;
    if canvases.is_empty() {
        return Err("App data must contain at least one canvas".to_string());
    }

    let mut canvas_ids = HashSet::new();
    for (index, canvas) in canvases.iter().enumerate() {
        let context = format!("canvases[{index}]");
        let object = canvas
            .as_object()
            .ok_or_else(|| format!("{context} must be an object"))?;
        let id = required_string(object, "id", &context)?;
        if !canvas_ids.insert(id.to_string()) {
            return Err(format!("App data contains duplicate canvas ID {id}"));
        }
        string_value(object, "name", &context)?;
        required_number(object, "width", &context, true)?;
        required_number(object, "height", &context, true)?;
        required_number(object, "zoom", &context, true)?;
        let pan = object
            .get("pan")
            .and_then(serde_json::Value::as_object)
            .ok_or_else(|| format!("{context}.pan must be an object"))?;
        required_number(pan, "x", &format!("{context}.pan"), false)?;
        required_number(pan, "y", &format!("{context}.pan"), false)?;

        if let Some(preview) = object.get("previewViewport") {
            let preview = preview
                .as_object()
                .ok_or_else(|| format!("{context}.previewViewport must be an object"))?;
            required_number(
                preview,
                "width",
                &format!("{context}.previewViewport"),
                true,
            )?;
            required_number(
                preview,
                "height",
                &format!("{context}.previewViewport"),
                true,
            )?;
        }

        let mut element_ids = HashSet::new();
        for field in CANVAS_CONTENT_FIELDS {
            if !object.contains_key(field) {
                return Err(format!("{context}.{field} is required"));
            }
            validate_elements(object, field, &context, &mut element_ids)?;
        }
    }
    Ok(())
}

pub(crate) fn validate_app_data_v1(data: &AppData) -> Result<(), String> {
    let object = data
        .as_object()
        .ok_or_else(|| "App data must be a JSON object".to_string())?;
    if object
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(APP_DATA_SCHEMA_VERSION)
    {
        return Err(format!(
            "App data schemaVersion must be {APP_DATA_SCHEMA_VERSION}"
        ));
    }

    let active_canvas_id = required_string(object, "activeCanvasId", "appData")?;
    let canvases = object
        .get("canvases")
        .ok_or_else(|| "appData.canvases is required".to_string())?;
    validate_canvases(canvases)?;
    let canvas_array = canvases
        .as_array()
        .ok_or_else(|| "appData.canvases must be an array".to_string())?;
    if !canvas_array.iter().any(|canvas| {
        canvas.get("id").and_then(serde_json::Value::as_str) == Some(active_canvas_id)
    }) {
        return Err("appData.activeCanvasId must reference an existing canvas".to_string());
    }

    if !matches!(
        object
            .get("canvasGridStyle")
            .and_then(serde_json::Value::as_str),
        Some("dots" | "lines")
    ) {
        return Err("appData.canvasGridStyle must be dots or lines".to_string());
    }
    let opacity = object
        .get("canvasGridOpacity")
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| "appData.canvasGridOpacity must be an object".to_string())?;
    for field in ["dots", "lines"] {
        let value = required_number(opacity, field, "appData.canvasGridOpacity", false)?;
        if !(0.0..=100.0).contains(&value) {
            return Err(format!(
                "appData.canvasGridOpacity.{field} must be between 0 and 100"
            ));
        }
    }
    for field in [
        "discordRpcEnabled",
        "discordRpcShowCanvas",
        "minimapEnabled",
        "privacyModeEnabled",
        "toolbarButtonsVisible",
    ] {
        if object
            .get(field)
            .and_then(serde_json::Value::as_bool)
            .is_none()
        {
            return Err(format!("appData.{field} must be a boolean"));
        }
    }
    optional_string(object, "dismissedUpdateVersion", "appData", false)?;
    Ok(())
}

pub(crate) fn collect_image_ids(value: &serde_json::Value, out: &mut HashSet<String>) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, child) in map {
                if key == "imageId" {
                    if let serde_json::Value::String(hash) = child {
                        out.insert(hash.clone());
                    }
                }
                collect_image_ids(child, out);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                collect_image_ids(item, out);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_app_data() -> AppData {
        serde_json::from_str(include_str!("../../fixtures/app-data-v1.json"))
            .expect("shared AppDataV1 fixture should be valid JSON")
    }

    #[test]
    fn migrates_unversioned_app_data_to_v1() {
        let data = json!({
            "activeCanvasId": "one",
            "canvases": [{
                "id": "one",
                "name": "Canvas",
                "width": 3000,
                "height": 3000,
                "containers": [],
                "textCards": [],
                "textBlocks": [],
                "images": [],
                "pan": {"x": 0, "y": 0},
                "zoom": 1
            }]
        });
        let migrated = migrate_app_data(data).expect("v0 data should migrate");
        assert_eq!(migrated["schemaVersion"], json!(1));
        assert_eq!(migrated["canvasGridStyle"], json!("dots"));
        assert_eq!(migrated["discordRpcShowCanvas"], json!(true));
    }

    #[test]
    fn migrates_legacy_root_data_with_defaults() {
        let migrated = migrate_app_data(json!({
            "containers": null,
            "textBlocks": [{
                "id": "legacy-text",
                "text": "Legacy",
                "x": 20,
                "y": 30,
                "width": 240,
                "height": 160,
                "accent": "#476FA8"
            }]
        }))
        .expect("legacy root data should migrate");
        assert_eq!(migrated["activeCanvasId"], json!("canvas-1"));
        assert_eq!(migrated["canvases"][0]["width"], json!(3000));
        assert_eq!(
            migrated["canvases"][0]["containers"][0]["id"],
            json!("container-1")
        );
        assert_eq!(
            migrated["canvases"][0]["textBlocks"][0]["name"],
            json!("Text block 1")
        );
        validate_app_data_v1(&migrated).expect("migrated legacy data should be valid v1");
    }

    #[test]
    fn shared_v1_fixture_matches_backend_contract() {
        let fixture = valid_app_data();
        assert_eq!(migrate_app_data(fixture.clone()).unwrap(), fixture);
    }

    #[test]
    fn v1_validation_rejects_invalid_settings_and_extensions() {
        let mut invalid = valid_app_data();
        invalid["minimapEnabled"] = json!("yes");
        assert!(migrate_app_data(invalid).is_err());

        let mut invalid = valid_app_data();
        invalid["canvasGridOpacity"]["dots"] = json!(101);
        assert!(migrate_app_data(invalid).is_err());

        let mut invalid = valid_app_data();
        invalid["canvases"][0]["containers"][0]["extensions"]["lock"] = json!({ "enabled": "yes" });
        assert!(migrate_app_data(invalid).is_err());

        let mut invalid = valid_app_data();
        invalid["canvases"][0]["containers"][0]["extensions"]["copyPasteJson"] =
            json!({ "enabled": "yes" });
        assert!(migrate_app_data(invalid).is_err());

        let mut valid_command_runner = valid_app_data();
        valid_command_runner["canvases"][0]["textCards"][0]["extensions"] = json!({
            "commandRunner": {
                "commands": [{
                    "command": "npm test",
                    "workingDirectory": "C:\\project",
                    "runMode": "background"
                }]
            }
        });
        assert!(migrate_app_data(valid_command_runner.clone()).is_ok());

        valid_command_runner["canvases"][0]["textCards"][0]["extensions"]["checkbox"] =
            json!({ "checked": false });
        assert!(migrate_app_data(valid_command_runner).is_err());

        let mut blank_command = valid_app_data();
        blank_command["canvases"][0]["textCards"][0]["extensions"] = json!({
            "commandRunner": { "commands": [{ "command": " ", "runMode": "terminal" }] }
        });
        assert!(migrate_app_data(blank_command).is_err());

        let mut invalid_directory = valid_app_data();
        invalid_directory["canvases"][0]["textCards"][0]["extensions"] = json!({
            "commandRunner": {
                "commands": [{
                    "command": "npm test",
                    "workingDirectory": 42,
                    "runMode": "background"
                }]
            }
        });
        assert!(migrate_app_data(invalid_directory).is_err());

        let mut invalid_run_mode = valid_app_data();
        invalid_run_mode["canvases"][0]["textCards"][0]["extensions"] = json!({
            "commandRunner": {
                "commands": [{ "command": "npm test", "runMode": "hidden" }]
            }
        });
        assert!(migrate_app_data(invalid_run_mode).is_err());
    }

    #[test]
    fn rejects_future_and_malformed_schema_versions() {
        assert!(migrate_app_data(json!({"schemaVersion": 2, "canvases": []})).is_err());
        assert!(migrate_app_data(json!({"schemaVersion": "1", "canvases": []})).is_err());
        assert!(migrate_app_data(json!([])).is_err());
        assert!(migrate_app_data(json!({"schemaVersion": 1, "canvases": []})).is_err());
    }
}
