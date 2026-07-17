use crate::error::{command_result, CommandResult};
use crate::model::collect_image_ids;
use crate::storage::{
    database_error, decrypt_with_key, encrypt_with_key, get_database_key,
    load_app_data_from_database, open_database, with_storage, EncryptedPayload, StorageSession,
};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::codecs::gif::GifDecoder;
use image::imageops::FilterType;
use image::{AnimationDecoder, ImageDecoder, ImageReader, Limits};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufReader, Cursor, Read};
use tauri_plugin_dialog::DialogExt;

/// Longest edge (px) a raster image is downscaled to on import. Matches the
/// canvas size so nothing loses detail at full zoom.
const IMAGE_MAX_EDGE: u32 = 2560;
/// WebP quality (0-100) for lossy re-encoding of raster images.
const IMAGE_WEBP_QUALITY: f32 = 80.0;
const IMAGE_MAX_INPUT_BYTES: u64 = 50 * 1024 * 1024;
const IMAGE_MAX_DIMENSION: u32 = 16_384;
const IMAGE_MAX_PIXELS: u64 = 64_000_000;
const IMAGE_MAX_DECODE_ALLOC: u64 = 256 * 1024 * 1024;
const IMAGE_MAX_ANIMATION_FRAMES: usize = 500;
const IMAGE_MAX_ANIMATION_PIXELS: u64 = 256_000_000;
const SVG_MAX_ELEMENTS: usize = 10_000;
const SVG_MAX_ATTRIBUTES: usize = 50_000;
const SVG_MAX_DEPTH: usize = 64;

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

fn looks_like_svg(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(512)];
    let text = String::from_utf8_lossy(head);
    let trimmed = text.trim_start();
    trimmed.starts_with("<svg") || (trimmed.starts_with("<?xml") && text.contains("<svg"))
}

fn parse_svg_length(value: &str) -> Option<f64> {
    let value = value.trim();
    let numeric = value.strip_suffix("px").unwrap_or(value).trim();
    let parsed = numeric.parse::<f64>().ok()?;
    parsed
        .is_finite()
        .then_some(parsed)
        .filter(|value| *value > 0.0)
}

fn parse_svg_view_box(value: &str) -> Option<(f64, f64)> {
    let values = value
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter(|part| !part.is_empty())
        .map(str::parse::<f64>)
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    if values.len() != 4 || values.iter().any(|value| !value.is_finite()) {
        return None;
    }
    (values[2] > 0.0 && values[3] > 0.0).then_some((values[2], values[3]))
}

fn checked_image_dimensions(width: f64, height: f64, context: &str) -> Result<(u32, u32), String> {
    if !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 {
        return Err(format!("{context} must have positive finite dimensions"));
    }
    if width > f64::from(IMAGE_MAX_DIMENSION) || height > f64::from(IMAGE_MAX_DIMENSION) {
        return Err(format!(
            "{context} dimensions exceed the {IMAGE_MAX_DIMENSION}-pixel edge limit"
        ));
    }
    let pixels = width * height;
    if pixels > IMAGE_MAX_PIXELS as f64 {
        return Err(format!(
            "{context} dimensions exceed the {IMAGE_MAX_PIXELS}-pixel limit"
        ));
    }
    Ok((width.ceil() as u32, height.ceil() as u32))
}

fn validate_svg(bytes: &[u8]) -> Result<(u32, u32), String> {
    ensure_image_input_size(bytes.len())?;
    let text =
        std::str::from_utf8(bytes).map_err(|error| format!("SVG must be valid UTF-8: {error}"))?;
    if text.contains("<!DOCTYPE") || text.contains("<!ENTITY") {
        return Err("SVG document types and entities are not supported".to_string());
    }
    let document =
        roxmltree::Document::parse(text).map_err(|error| format!("SVG XML is invalid: {error}"))?;
    let root = document.root_element();
    if root.tag_name().name() != "svg" {
        return Err("SVG root element must be <svg>".to_string());
    }

    let mut elements = 0_usize;
    let mut attributes = 0_usize;
    for node in document.descendants().filter(roxmltree::Node::is_element) {
        elements += 1;
        attributes += node.attributes().len();
        let depth = node.ancestors().filter(roxmltree::Node::is_element).count();
        if elements > SVG_MAX_ELEMENTS || attributes > SVG_MAX_ATTRIBUTES || depth > SVG_MAX_DEPTH {
            return Err("SVG complexity exceeds safe limits".to_string());
        }
        if matches!(
            node.tag_name().name(),
            "script" | "foreignObject" | "iframe" | "object" | "embed"
        ) {
            return Err(format!(
                "SVG element <{}> is not supported",
                node.tag_name().name()
            ));
        }
    }

    let explicit = root
        .attribute("width")
        .and_then(parse_svg_length)
        .zip(root.attribute("height").and_then(parse_svg_length));
    let dimensions = explicit.or_else(|| root.attribute("viewBox").and_then(parse_svg_view_box));
    let (width, height) = dimensions.ok_or_else(|| {
        "SVG must declare safe numeric width/height or a positive viewBox".to_string()
    })?;
    checked_image_dimensions(width, height, "SVG")
}

fn validate_gif_animation(bytes: &[u8]) -> Result<(u32, u32), String> {
    ensure_image_input_size(bytes.len())?;
    let mut decoder = GifDecoder::new(BufReader::new(Cursor::new(bytes)))
        .map_err(|error| format!("Could not decode GIF: {error}"))?;
    let (width, height) = decoder.dimensions();
    checked_image_dimensions(f64::from(width), f64::from(height), "GIF")?;
    decoder
        .set_limits(image_decode_limits())
        .map_err(|error| format!("GIF exceeds decoder limits: {error}"))?;

    let frame_pixels = u64::from(width) * u64::from(height);
    let mut frame_count = 0_usize;
    for frame in decoder.into_frames() {
        frame.map_err(|error| format!("Could not decode GIF frame: {error}"))?;
        frame_count += 1;
        validate_animation_budget(frame_pixels, frame_count)?;
    }
    if frame_count == 0 {
        return Err("GIF contains no frames".to_string());
    }
    Ok((width, height))
}

fn validate_animation_budget(frame_pixels: u64, frame_count: usize) -> Result<(), String> {
    let aggregate_pixels = frame_pixels
        .checked_mul(frame_count as u64)
        .ok_or_else(|| "GIF aggregate pixel count overflowed".to_string())?;
    if frame_count > IMAGE_MAX_ANIMATION_FRAMES || aggregate_pixels > IMAGE_MAX_ANIMATION_PIXELS {
        return Err(format!(
            "GIF animation exceeds the {IMAGE_MAX_ANIMATION_FRAMES}-frame or {IMAGE_MAX_ANIMATION_PIXELS}-pixel aggregate limit"
        ));
    }
    Ok(())
}

pub(crate) fn validate_stored_media(bytes: &[u8]) -> Result<(), String> {
    if looks_like_svg(bytes) {
        validate_svg(bytes)?;
        return Ok(());
    }
    match image::guess_format(bytes)
        .map_err(|error| format!("Stored image format is invalid: {error}"))?
    {
        image::ImageFormat::Gif => {
            validate_gif_animation(bytes)?;
        }
        image::ImageFormat::WebP => {
            decode_raster(bytes)?;
        }
        _ => return Err("Stored image format is unsupported".to_string()),
    }
    Ok(())
}

fn ensure_image_input_size(byte_len: usize) -> Result<(), String> {
    if byte_len as u64 > IMAGE_MAX_INPUT_BYTES {
        return Err(format!(
            "Image is too large; the input limit is {} MiB",
            IMAGE_MAX_INPUT_BYTES / 1024 / 1024
        ));
    }
    Ok(())
}

fn image_decode_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(IMAGE_MAX_DIMENSION);
    limits.max_image_height = Some(IMAGE_MAX_DIMENSION);
    limits.max_alloc = Some(IMAGE_MAX_DECODE_ALLOC);
    limits
}

fn decode_raster(bytes: &[u8]) -> Result<(image::ImageFormat, image::DynamicImage), String> {
    ensure_image_input_size(bytes.len())?;
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| format!("Unsupported image data: {error}"))?;
    let format = reader
        .format()
        .ok_or_else(|| "Unsupported image data".to_string())?;
    reader.limits(image_decode_limits());
    let decoded = reader
        .decode()
        .map_err(|error| format!("Could not decode image within resource limits: {error}"))?;
    let pixels = u64::from(decoded.width()) * u64::from(decoded.height());
    if pixels > IMAGE_MAX_PIXELS {
        return Err(format!(
            "Image dimensions exceed the {IMAGE_MAX_PIXELS}-pixel limit"
        ));
    }
    Ok((format, decoded))
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

/// Normalize an incoming image into the bytes we actually persist.
/// - SVG: kept verbatim.
/// - GIF: kept verbatim to preserve animation.
/// - Everything else: decoded, downscaled to `IMAGE_MAX_EDGE`, re-encoded WebP.
fn normalize_image(bytes: &[u8]) -> Result<(String, Vec<u8>, u32, u32), String> {
    ensure_image_input_size(bytes.len())?;
    if looks_like_svg(bytes) {
        let (width, height) = validate_svg(bytes)?;
        return Ok(("svg".to_string(), bytes.to_vec(), width, height));
    }

    let format =
        image::guess_format(bytes).map_err(|error| format!("Unsupported image data: {error}"))?;

    if format == image::ImageFormat::Gif {
        let (width, height) = validate_gif_animation(bytes)?;
        return Ok(("gif".to_string(), bytes.to_vec(), width, height));
    }

    let (_, decoded) = decode_raster(bytes)?;
    let (width, height) = (decoded.width(), decoded.height());
    let scaled = if width.max(height) > IMAGE_MAX_EDGE {
        decoded.resize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, FilterType::Lanczos3)
    } else {
        decoded
    };

    let rgba = scaled.to_rgba8();
    let (out_width, out_height) = (rgba.width(), rgba.height());
    let encoder = webp::Encoder::from_rgba(&rgba, out_width, out_height);
    let encoded = encoder.encode(IMAGE_WEBP_QUALITY);

    Ok(("webp".to_string(), encoded.to_vec(), out_width, out_height))
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
