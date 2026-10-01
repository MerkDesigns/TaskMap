use std::path::Path;

/// Product facts come from the main app's Tauri config so the installer can never disagree with
/// the payload it was built for. `TASKMAP_INSTALLER_EDITION_CONFIG` names an overlay config (the
/// development edition, shown as TaskMap Beta) whose `productName` wins.
fn product_facts() -> (String, String, bool) {
    let read = |path: &str| -> serde_json::Value {
        let text = std::fs::read_to_string(path).unwrap_or_else(|error| panic!("{path}: {error}"));
        serde_json::from_str(&text).unwrap_or_else(|error| panic!("{path}: {error}"))
    };
    let base = read("../src-tauri/tauri.conf.json");
    let overlay = std::env::var("TASKMAP_INSTALLER_EDITION_CONFIG")
        .ok()
        .map(|name| read(&format!("../src-tauri/{name}")));
    let field = |key: &str| {
        overlay
            .as_ref()
            .and_then(|config| config[key].as_str())
            .or_else(|| base[key].as_str())
            .unwrap_or_else(|| panic!("tauri.conf.json has no {key}"))
            .to_owned()
    };
    (field("productName"), field("version"), overlay.is_none())
}

fn main() {
    println!("cargo::rerun-if-changed=../src-tauri/tauri.conf.json");
    println!("cargo::rerun-if-env-changed=TASKMAP_INSTALLER_EDITION_CONFIG");
    println!("cargo::rerun-if-env-changed=TASKMAP_INSTALLER_PAYLOAD");
    println!("cargo::rustc-check-cfg=cfg(embedded_payload)");

    let (product_name, version, stable) = product_facts();
    println!("cargo::rustc-env=TASKMAP_PRODUCT_NAME={product_name}");
    println!("cargo::rustc-env=TASKMAP_STABLE_EDITION={stable}");
    println!("cargo::rustc-env=TASKMAP_PRODUCT_VERSION={version}");

    // Release installers must carry the NSIS installer they present; only development builds may
    // simulate installation.
    match std::env::var("TASKMAP_INSTALLER_PAYLOAD") {
        Ok(payload) => {
            let payload = Path::new(&payload)
                .canonicalize()
                .unwrap_or_else(|error| panic!("TASKMAP_INSTALLER_PAYLOAD {payload}: {error}"));
            println!("cargo::rerun-if-changed={}", payload.display());
            println!(
                "cargo::rustc-env=TASKMAP_PAYLOAD_PATH={}",
                payload.display()
            );
            println!("cargo::rustc-cfg=embedded_payload");
        }
        Err(_) if std::env::var("PROFILE").as_deref() == Ok("release") => {
            panic!(
                "release installers need TASKMAP_INSTALLER_PAYLOAD (use npm run installer:build)"
            )
        }
        Err(_) => {}
    }

    let commands: &'static [&'static str] = &[
        "installer_details",
        "installer_choose_location",
        "installer_run",
        "installer_launch",
    ];
    let capabilities_path_pattern = if std::env::var_os("CARGO_FEATURE_MCP_DEVELOPMENT").is_some() {
        "./capabilities/**/*.json"
    } else {
        "./capabilities/*.json"
    };
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(commands))
        .capabilities_path_pattern(capabilities_path_pattern);
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}
