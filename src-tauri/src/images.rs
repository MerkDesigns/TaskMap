use crate::error::{command_result, CommandResult};
use crate::model::collect_image_ids;
use crate::storage::{
    database_error, decrypt_with_key, encrypt_with_key, get_database_key,
    load_app_data_from_database, open_database, with_storage, EncryptedPayload, StorageSession,
};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufReader, Read};
use tauri_plugin_dialog::DialogExt;

use crate::image_processing::*;

/// Metadata returned to the frontend after an image is stored. The frontend
/// keeps only this on the element; the bytes stay in the `images` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ImageMeta {
    pub(crate) hash: String,
    pub(crate) format: String,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

/// A full image (meta + raw bytes) used only when bundling into / restoring
/// from an encrypted export. Never part of `app_data`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct BundledImage {
    pub(crate) hash: String,
    pub(crate) format: String,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) data: String,
}

pub(crate) struct ValidatedBundledImage {
    hash: String,
    format: String,
    width: u32,
    height: u32,
    bytes: Vec<u8>,
}

fn read_limited_file(path: &str) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|error| format!("Could not read file: {error}"))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("Could not inspect file: {error}"))?;
    if metadata.len() > IMAGE_MAX_INPUT_BYTES {
        return Err(format!(
            "Image is too large; the input limit is {} MiB",
            IMAGE_MAX_INPUT_BYTES / 1024 / 1024
        ));
    }

    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    BufReader::new(file)
        .take(IMAGE_MAX_INPUT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read file: {error}"))?;
    ensure_image_input_size(bytes.len())?;
    Ok(bytes)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(crate) fn image_meta_by_hash(
    connection: &Connection,
    hash: &str,
) -> Result<Option<ImageMeta>, String> {
    connection
        .query_row(
            "SELECT format, width, height FROM images WHERE hash = ?1",
            [hash],
            |row| {
                Ok(ImageMeta {
                    hash: hash.to_string(),
                    format: row.get(0)?,
                    width: row.get::<_, i64>(1)? as u32,
                    height: row.get::<_, i64>(2)? as u32,
                })
            },
        )
        .optional()
        .map_err(database_error)
}

fn store_normalized_image(
    connection: &Connection,
    key: &[u8; 32],
    format: &str,
    bytes: &[u8],
    width: u32,
    height: u32,
) -> Result<ImageMeta, String> {
    let hash = hash_bytes(bytes);

    if let Some(existing) = image_meta_by_hash(connection, &hash)? {
        return Ok(existing);
    }

    let encrypted = encrypt_with_key(bytes, key)?;
    let stored = serde_json::to_vec(&encrypted).map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO images (hash, format, width, height, bytes)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(hash) DO NOTHING",
            params![hash, format, width as i64, height as i64, stored],
        )
        .map_err(database_error)?;

    Ok(ImageMeta {
        hash,
        format: format.to_string(),
        width,
        height,
    })
}

pub(crate) fn read_image_bytes(
    connection: &Connection,
    key: &[u8; 32],
    hash: &str,
) -> Result<Vec<u8>, String> {
    let stored: Vec<u8> = connection
        .query_row("SELECT bytes FROM images WHERE hash = ?1", [hash], |row| {
            row.get(0)
        })
        .optional()
        .map_err(database_error)?
        .ok_or_else(|| "Image not found".to_string())?;

    let encrypted: EncryptedPayload = serde_json::from_slice(&stored)
        .map_err(|error| format!("Stored image is invalid: {error}"))?;
    decrypt_with_key(&encrypted, key)
}

pub(crate) fn validate_bundled_image(
    image: &BundledImage,
) -> Result<ValidatedBundledImage, String> {
    let max_encoded_len = (IMAGE_MAX_INPUT_BYTES as usize).div_ceil(3) * 4 + 4;
    if image.data.len() > max_encoded_len {
        return Err(format!("Bundled image {} is too large", image.hash));
    }
    let bytes = BASE64
        .decode(&image.data)
        .map_err(|error| format!("Bundled image is invalid: {error}"))?;
    ensure_image_input_size(bytes.len())?;
    let calculated_hash = hash_bytes(&bytes);
    if calculated_hash != image.hash {
        return Err(format!(
            "Bundled image hash does not match its contents: {}",
            image.hash
        ));
    }

    let (format, width, height, legacy_dimensions_allowed) = if looks_like_svg(&bytes) {
        let (width, height) = validate_svg(&bytes)?;
        ("svg".to_string(), width, height, true)
    } else {
        let detected_format = image::guess_format(&bytes)
            .map_err(|error| format!("Bundled image format is invalid: {error}"))?;
        match detected_format {
            image::ImageFormat::Gif => {
                let (width, height) = validate_gif_animation(&bytes)?;
                ("gif".to_string(), width, height, false)
            }
            image::ImageFormat::WebP => {
                let (_, decoded) = decode_raster(&bytes)?;
                ("webp".to_string(), decoded.width(), decoded.height(), false)
            }
            _ => {
                return Err(format!(
                    "Bundled image {} has an unsupported stored format",
                    image.hash
                ))
            }
        }
    };
    let legacy_unknown_dimensions =
        legacy_dimensions_allowed && image.width == 0 && image.height == 0;
    if format != image.format
        || (!legacy_unknown_dimensions && (width != image.width || height != image.height))
    {
        return Err(format!(
            "Bundled image metadata does not match its contents: {}",
            image.hash
        ));
    }

    Ok(ValidatedBundledImage {
        hash: image.hash.clone(),
        format,
        width,
        height,
        bytes,
    })
}

pub(crate) fn restore_validated_image(
    connection: &Connection,
    key: &[u8; 32],
    image: &ValidatedBundledImage,
) -> Result<(), String> {
    let meta = store_normalized_image(
        connection,
        key,
        &image.format,
        &image.bytes,
        image.width,
        image.height,
    )?;
    if meta.hash != image.hash {
        return Err(format!(
            "Bundled image hash changed while restoring: {}",
            image.hash
        ));
    }
    Ok(())
}

fn persist_normalized_image(
    app: &tauri::AppHandle,
    session: &mut StorageSession,
    format: &str,
    normalized: &[u8],
    width: u32,
    height: u32,
) -> Result<ImageMeta, String> {
    let connection = open_database(app)?;
    let key = get_database_key(session, true)?;
    store_normalized_image(&connection, &key, format, normalized, width, height)
}

#[tauri::command]
pub(crate) async fn store_image(app: tauri::AppHandle, data: String) -> CommandResult<ImageMeta> {
    command_result(crate::storage_preview::require_legacy_storage())?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let data = data.trim();
        let max_encoded_len = (IMAGE_MAX_INPUT_BYTES as usize).div_ceil(3) * 4 + 4;
        if data.len() > max_encoded_len {
            return Err(format!(
                "Image is too large; the input limit is {} MiB",
                IMAGE_MAX_INPUT_BYTES / 1024 / 1024
            ));
        }
        let bytes = BASE64
            .decode(data)
            .map_err(|error| format!("Image data is invalid: {error}"))?;
        ensure_image_input_size(bytes.len())?;
        let (format, normalized, width, height) = normalize_image(&bytes)?;
        with_storage(&app, |session| {
            persist_normalized_image(&app, session, &format, &normalized, width, height)
        })
    })
    .await
    .map_err(|error| format!("Image processing failed: {error}"))?;
    command_result(result)
}

#[tauri::command]
pub(crate) async fn load_image(app: tauri::AppHandle, hash: String) -> CommandResult<String> {
    command_result(crate::storage_preview::require_legacy_storage())?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let bytes = with_storage(&app, |session| {
            let connection = open_database(&app)?;
            let key = get_database_key(session, false)?;
            read_image_bytes(&connection, &key, &hash)
        })?;
        validate_stored_media(&bytes)?;
        Ok(BASE64.encode(bytes))
    })
    .await
    .map_err(|error| format!("Image loading failed: {error}"))?;
    command_result(result)
}

#[tauri::command]
pub(crate) fn pick_image_path(app: tauri::AppHandle) -> CommandResult<Option<String>> {
    command_result(crate::storage_preview::require_legacy_storage())?;
    let path = app
        .dialog()
        .file()
        .add_filter(
            "Images",
            &["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"],
        )
        .blocking_pick_file();

    command_result(match path {
        Some(path) => Ok(Some(
            path.into_path()
                .map_err(|error| format!("Could not resolve selected file: {error}"))?
                .to_string_lossy()
                .into_owned(),
        )),
        None => Ok(None),
    })
}

#[tauri::command]
pub(crate) async fn store_image_path(
    app: tauri::AppHandle,
    path: String,
) -> CommandResult<ImageMeta> {
    command_result(crate::storage_preview::require_legacy_storage())?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let bytes = read_limited_file(&path)?;
        let (format, normalized, width, height) = normalize_image(&bytes)?;
        with_storage(&app, |session| {
            persist_normalized_image(&app, session, &format, &normalized, width, height)
        })
    })
    .await
    .map_err(|error| format!("Image processing failed: {error}"))?;
    command_result(result)
}

pub(crate) fn delete_unused_images(
    connection: &Connection,
    used: &HashSet<String>,
) -> Result<(), String> {
    let hashes: Vec<String> = {
        let mut statement = connection
            .prepare("SELECT hash FROM images")
            .map_err(database_error)?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(database_error)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(database_error)?
    };

    for hash in hashes {
        if !used.contains(&hash) {
            connection
                .execute("DELETE FROM images WHERE hash = ?1", [&hash])
                .map_err(database_error)?;
        }
    }

    Ok(())
}

/// Garbage collection is intentionally startup-only. At this point no undo
/// history, clipboard template, or in-flight import can reference an image that
/// is absent from the authoritative persisted app data.
pub(crate) fn gc_images_at_startup(app: &tauri::AppHandle) -> Result<(), String> {
    with_storage(app, |session| {
        let Some(data) = load_app_data_from_database(app, session)? else {
            let connection = open_database(app)?;
            return delete_unused_images(&connection, &HashSet::new());
        };
        let mut used = HashSet::new();
        collect_image_ids(&data, &mut used);
        let connection = open_database(app)?;
        delete_unused_images(&connection, &used)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn one_frame_gif() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut encoder = image::codecs::gif::GifEncoder::new(&mut bytes);
            let image = image::RgbaImage::from_pixel(2, 2, image::Rgba([10, 20, 30, 255]));
            encoder
                .encode_frame(image::Frame::new(image))
                .expect("test GIF should encode");
        }
        bytes
    }

    fn create_test_schema(connection: &Connection) {
        connection
            .execute_batch(
                "CREATE TABLE app_data (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE images (
                    hash TEXT PRIMARY KEY,
                    format TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    bytes BLOB NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );",
            )
            .expect("test schema should be created");
    }

    #[test]
    fn bundled_images_require_matching_hash_and_metadata() {
        let connection = Connection::open_in_memory().unwrap();
        create_test_schema(&connection);
        let key = [7_u8; 32];
        let bytes = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 24\"></svg>";
        let valid = BundledImage {
            hash: hash_bytes(bytes),
            format: "svg".to_string(),
            width: 0,
            height: 0,
            data: BASE64.encode(bytes),
        };
        let validated = validate_bundled_image(&valid).expect("valid image should validate");
        restore_validated_image(&connection, &key, &validated).expect("valid image should restore");
        assert!(image_meta_by_hash(&connection, &valid.hash)
            .unwrap()
            .is_some());

        let mut invalid = valid.clone();
        invalid.hash = "0".repeat(64);
        assert!(validate_bundled_image(&invalid).is_err());

        let mut invalid = valid;
        invalid.width = 1;
        assert!(validate_bundled_image(&invalid).is_err());
    }

    #[test]
    fn image_size_limit_is_enforced_before_allocation() {
        assert!(ensure_image_input_size(IMAGE_MAX_INPUT_BYTES as usize).is_ok());
        assert!(ensure_image_input_size(IMAGE_MAX_INPUT_BYTES as usize + 1).is_err());
    }

    #[test]
    fn svg_and_gif_resource_limits_are_enforced() {
        let valid_svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 48\"></svg>";
        assert_eq!(validate_svg(valid_svg).unwrap(), (64, 48));
        assert!(validate_svg(b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>").is_err());
        assert!(validate_svg(
            b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 48\"><script/></svg>"
        )
        .is_err());

        let gif = one_frame_gif();
        assert_eq!(validate_gif_animation(&gif).unwrap(), (2, 2));
        assert!(validate_animation_budget(1, IMAGE_MAX_ANIMATION_FRAMES + 1).is_err());
        assert!(validate_animation_budget(IMAGE_MAX_ANIMATION_PIXELS, 2).is_err());
    }
}
