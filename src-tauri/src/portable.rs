use crate::error::{command_result, CommandResult};
use crate::images::{
    image_meta_by_hash, read_image_bytes, restore_validated_image, validate_bundled_image,
    validate_stored_media, BundledImage,
};
use crate::model::{collect_image_ids, migrate_app_data, AppData};
use crate::storage::{
    database_error, decrypt_with_key, encrypt_with_key, get_database_key, open_database,
    random_bytes, save_app_data_in_transaction, with_storage, EncryptedPayload,
};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use pbkdf2::pbkdf2_hmac;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashSet;
use std::fs;
use tauri_plugin_dialog::DialogExt;

const EXPORT_VERSION: u8 = 1;
const EXPORT_KDF_ITERATIONS: u32 = 210_000;
const EXPORT_FILE_EXTENSION: &str = "tmap";
const IMPORT_MAX_PAYLOAD_BYTES: usize = 512 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExportPayload {
    version: u8,
    kdf: String,
    iterations: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
}

/// The decrypted body of an export. Images are bundled so the file is portable
/// across machines. Old exports were the bare `AppData` JSON; `from_plaintext`
/// handles both shapes.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExportBody {
    data: AppData,
    #[serde(default)]
    images: Vec<BundledImage>,
}

impl ExportBody {
    fn from_plaintext(plaintext: &[u8]) -> Result<Self, String> {
        if let Ok(body) = serde_json::from_slice::<ExportBody>(plaintext) {
            validate_export_image_completeness(&body.data, &body.images)?;
            return Ok(body);
        }
        // Backward compatibility: an export written before image bundling is the
        // bare AppData value.
        let data: AppData = serde_json::from_slice(plaintext)
            .map_err(|error| format!("Export data is invalid: {error}"))?;
        Ok(ExportBody {
            data,
            images: Vec::new(),
        })
    }
}

fn derive_export_key(password: &str, salt: &[u8], iterations: u32) -> Result<[u8; 32], String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }

    let mut key = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
    Ok(key)
}

fn validate_export_image_completeness(
    data: &AppData,
    images: &[BundledImage],
) -> Result<(), String> {
    let mut referenced = HashSet::new();
    collect_image_ids(data, &mut referenced);
    let bundled: HashSet<&str> = images.iter().map(|image| image.hash.as_str()).collect();
    if let Some(missing) = referenced
        .iter()
        .find(|hash| !bundled.contains(hash.as_str()))
    {
        return Err(format!(
            "Export is missing referenced bundled image {missing}"
        ));
    }
    Ok(())
}

fn encrypt_export(
    data: &AppData,
    images: &[BundledImage],
    password: &str,
) -> Result<String, String> {
    validate_export_image_completeness(data, images)?;
    let salt = random_bytes::<16>();
    let key = derive_export_key(password, &salt, EXPORT_KDF_ITERATIONS)?;
    let body = ExportBody {
        data: data.clone(),
        images: images.to_vec(),
    };
    let encrypted = encrypt_with_key(
        serde_json::to_string(&body)
            .map_err(|error| error.to_string())?
            .as_bytes(),
        &key,
    )?;

    let payload = ExportPayload {
        version: EXPORT_VERSION,
        kdf: "pbkdf2-sha256".to_string(),
        iterations: EXPORT_KDF_ITERATIONS,
        salt: BASE64.encode(salt),
        nonce: encrypted.nonce,
        ciphertext: encrypted.ciphertext,
    };

    serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())
}

fn decrypt_export(payload: &str, password: &str) -> Result<(AppData, Vec<BundledImage>), String> {
    let export: ExportPayload = serde_json::from_str(payload)
        .map_err(|error| format!("Export file is invalid: {error}"))?;

    if export.version != EXPORT_VERSION || export.kdf != "pbkdf2-sha256" {
        return Err("Unsupported export file format".to_string());
    }

    if export.iterations != EXPORT_KDF_ITERATIONS {
        return Err(format!(
            "Export KDF iterations must be {EXPORT_KDF_ITERATIONS}"
        ));
    }

    let salt = BASE64
        .decode(export.salt)
        .map_err(|error| format!("Export salt is invalid: {error}"))?;
    if salt.len() != 16 {
        return Err("Export salt must be 16 bytes".to_string());
    }
    let key = derive_export_key(password, &salt, export.iterations)?;
    let plaintext = decrypt_with_key(
        &EncryptedPayload {
            version: 1,
            nonce: export.nonce,
            ciphertext: export.ciphertext,
        },
        &key,
    )?;

    let body = ExportBody::from_plaintext(&plaintext)?;
    Ok((body.data, body.images))
}

#[tauri::command]
pub(crate) async fn export_app_data(
    app: tauri::AppHandle,
    data: AppData,
    password: String,
) -> CommandResult<bool> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let data = migrate_app_data(data)?;
        let mut hashes = HashSet::new();
        collect_image_ids(&data, &mut hashes);

        let mut images = Vec::new();
        if !hashes.is_empty() {
            with_storage(&app, |session| {
                let connection = open_database(&app)?;
                let key = get_database_key(session, false)?;
                for hash in &hashes {
                    let meta = image_meta_by_hash(&connection, hash)?
                        .ok_or_else(|| format!("Export image {hash} was not found"))?;
                    let bytes = read_image_bytes(&connection, &key, hash)?;
                    validate_stored_media(&bytes)?;
                    images.push(BundledImage {
                        hash: meta.hash,
                        format: meta.format,
                        width: meta.width,
                        height: meta.height,
                        data: BASE64.encode(bytes),
                    });
                }
                Ok(())
            })?;
        }

        let payload = encrypt_export(&data, &images, &password)?;
        if payload.len() > IMPORT_MAX_PAYLOAD_BYTES {
            return Err(format!(
                "Export is too large; the portable file limit is {} MiB",
                IMPORT_MAX_PAYLOAD_BYTES / 1024 / 1024
            ));
        }
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("TaskMap files", &[EXPORT_FILE_EXTENSION])
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let mut path = file
            .into_path()
            .map_err(|error| format!("Could not resolve export path: {error}"))?;
        let has_tmap_extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.eq_ignore_ascii_case(EXPORT_FILE_EXTENSION))
            .unwrap_or(false);
        if !has_tmap_extension {
            path.set_extension(EXPORT_FILE_EXTENSION);
        }

        fs::write(&path, payload.as_bytes())
            .map_err(|error| format!("Could not save TaskMap export: {error}"))?;
        Ok(true)
    })
    .await
    .map_err(|error| format!("Export failed: {error}"))?;
    command_result(result)
}

#[tauri::command]
pub(crate) async fn import_app_data(
    app: tauri::AppHandle,
    payload: String,
    password: String,
) -> CommandResult<AppData> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        if payload.len() > IMPORT_MAX_PAYLOAD_BYTES {
            return Err(format!(
                "Import payload is too large; the limit is {} MiB",
                IMPORT_MAX_PAYLOAD_BYTES / 1024 / 1024
            ));
        }

        let (data, images) = decrypt_export(&payload, &password)?;
        let data = migrate_app_data(data)?;
        let images = images
            .iter()
            .map(validate_bundled_image)
            .collect::<Result<Vec<_>, _>>()?;

        with_storage(&app, |session| {
            let key = get_database_key(session, true)?;
            let mut connection = open_database(&app)?;
            let transaction = connection.transaction().map_err(database_error)?;
            for image in &images {
                restore_validated_image(&transaction, &key, image)?;
            }
            save_app_data_in_transaction(&transaction, &key, &data)?;
            transaction.commit().map_err(database_error)?;
            Ok(data)
        })
    })
    .await
    .map_err(|error| format!("Import failed: {error}"))?;
    command_result(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn export_round_trip_and_parameter_validation() {
        let data = json!({"schemaVersion": 1, "canvases": []});
        let payload =
            encrypt_export(&data, &[], "correct horse").expect("valid export should encrypt");
        let (decrypted, images) =
            decrypt_export(&payload, "correct horse").expect("valid export should decrypt");
        assert_eq!(decrypted, data);
        assert!(images.is_empty());

        let mut tampered: serde_json::Value = serde_json::from_str(&payload).unwrap();
        tampered["iterations"] = json!(1);
        assert!(decrypt_export(&tampered.to_string(), "correct horse").is_err());

        let mut tampered: serde_json::Value = serde_json::from_str(&payload).unwrap();
        tampered["salt"] = json!(BASE64.encode([0_u8; 8]));
        assert!(decrypt_export(&tampered.to_string(), "correct horse").is_err());

        let missing_image = json!({"schemaVersion": 1, "imageId": "missing"});
        assert!(encrypt_export(&missing_image, &[], "correct horse").is_err());

        let legacy_data = json!({"activeCanvasId": "legacy", "containers": []});
        let salt = [3_u8; 16];
        let key = derive_export_key("correct horse", &salt, EXPORT_KDF_ITERATIONS).unwrap();
        let encrypted = encrypt_with_key(&serde_json::to_vec(&legacy_data).unwrap(), &key).unwrap();
        let legacy_payload = ExportPayload {
            version: EXPORT_VERSION,
            kdf: "pbkdf2-sha256".to_string(),
            iterations: EXPORT_KDF_ITERATIONS,
            salt: BASE64.encode(salt),
            nonce: encrypted.nonce,
            ciphertext: encrypted.ciphertext,
        };
        let (decrypted, images) = decrypt_export(
            &serde_json::to_string(&legacy_payload).unwrap(),
            "correct horse",
        )
        .expect("legacy bare-data exports should stay readable");
        assert_eq!(decrypted, legacy_data);
        assert!(images.is_empty());
    }
}
