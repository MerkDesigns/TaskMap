use image::codecs::gif::GifDecoder;
use image::imageops::FilterType;
use image::{AnimationDecoder, ImageDecoder, ImageReader, Limits};
use std::io::{BufReader, Cursor};

/// Longest edge (px) a raster image is downscaled to on import. Matches the
/// canvas size so nothing loses detail at full zoom.
pub(crate) const IMAGE_MAX_EDGE: u32 = 2560;
/// WebP quality (0-100) for lossy re-encoding of raster images.
pub(crate) const IMAGE_WEBP_QUALITY: f32 = 80.0;
pub(crate) const IMAGE_MAX_INPUT_BYTES: u64 = 50 * 1024 * 1024;
pub(crate) const IMAGE_MAX_DIMENSION: u32 = 16_384;
pub(crate) const IMAGE_MAX_PIXELS: u64 = 64_000_000;
pub(crate) const IMAGE_MAX_DECODE_ALLOC: u64 = 256 * 1024 * 1024;
pub(crate) const IMAGE_MAX_ANIMATION_FRAMES: usize = 500;
pub(crate) const IMAGE_MAX_ANIMATION_PIXELS: u64 = 256_000_000;
pub(crate) const SVG_MAX_ELEMENTS: usize = 10_000;
pub(crate) const SVG_MAX_ATTRIBUTES: usize = 50_000;
pub(crate) const SVG_MAX_DEPTH: usize = 64;

pub(crate) fn looks_like_svg(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(512)];
    let text = String::from_utf8_lossy(head);
    let trimmed = text.trim_start();
    trimmed.starts_with("<svg") || (trimmed.starts_with("<?xml") && text.contains("<svg"))
}

pub(crate) fn parse_svg_length(value: &str) -> Option<f64> {
    let value = value.trim();
    let numeric = value.strip_suffix("px").unwrap_or(value).trim();
    let parsed = numeric.parse::<f64>().ok()?;
    parsed
        .is_finite()
        .then_some(parsed)
        .filter(|value| *value > 0.0)
}

pub(crate) fn parse_svg_view_box(value: &str) -> Option<(f64, f64)> {
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

pub(crate) fn checked_image_dimensions(
    width: f64,
    height: f64,
    context: &str,
) -> Result<(u32, u32), String> {
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

pub(crate) fn validate_svg(bytes: &[u8]) -> Result<(u32, u32), String> {
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

pub(crate) fn validate_gif_animation(bytes: &[u8]) -> Result<(u32, u32), String> {
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

pub(crate) fn validate_animation_budget(
    frame_pixels: u64,
    frame_count: usize,
) -> Result<(), String> {
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

pub(crate) fn ensure_image_input_size(byte_len: usize) -> Result<(), String> {
    if byte_len as u64 > IMAGE_MAX_INPUT_BYTES {
        return Err(format!(
            "Image is too large; the input limit is {} MiB",
            IMAGE_MAX_INPUT_BYTES / 1024 / 1024
        ));
    }
    Ok(())
}

pub(crate) fn image_decode_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(IMAGE_MAX_DIMENSION);
    limits.max_image_height = Some(IMAGE_MAX_DIMENSION);
    limits.max_alloc = Some(IMAGE_MAX_DECODE_ALLOC);
    limits
}

pub(crate) fn decode_raster(
    bytes: &[u8],
) -> Result<(image::ImageFormat, image::DynamicImage), String> {
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

/// Normalize an incoming image into the bytes we actually persist.
/// - SVG: kept verbatim.
/// - GIF: kept verbatim to preserve animation.
/// - Everything else: decoded, downscaled to `IMAGE_MAX_EDGE`, re-encoded WebP.
pub(crate) fn normalize_image(bytes: &[u8]) -> Result<(String, Vec<u8>, u32, u32), String> {
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
