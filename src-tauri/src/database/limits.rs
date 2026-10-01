use crate::error::{ServiceFailure, ServiceResult};

pub(crate) const DATABASE_ID_BYTES: usize = 45;
pub(crate) const MEDIA_ID_BYTES: usize = 24;
pub(crate) const AUTHORIZATION_TOKEN_BYTES: usize = 32;
pub(crate) const MAX_PASSWORD_BYTES: usize = 1_024;
pub(crate) const MAX_DOCUMENT_BYTES: usize = 64 * 1024 * 1024;
pub(crate) const AEAD_TAG_BYTES: usize = 16;
pub(crate) const MAX_CIPHERTEXT_BYTES: usize = MAX_DOCUMENT_BYTES + AEAD_TAG_BYTES;
pub(crate) const MAX_DEVELOPMENT_MEDIA_BYTES: usize = 64 * 1024 * 1024;
pub(crate) const MAX_MIME_TYPE_BYTES: usize = 255;
pub(crate) const MAX_TIMESTAMP_BYTES: usize = 32;
pub(crate) const KEY_CHECK_PLAINTEXT_BYTES: usize = 20;
pub(crate) const KEY_CHECK_CIPHERTEXT_BYTES: usize = KEY_CHECK_PLAINTEXT_BYTES + AEAD_TAG_BYTES;

pub(crate) fn validate_password(password: &[u8]) -> ServiceResult<()> {
    if password.is_empty() || password.len() > MAX_PASSWORD_BYTES {
        return Err(ServiceFailure::InvalidInput);
    }
    Ok(())
}

pub(crate) fn validate_document_size(byte_length: usize) -> ServiceResult<()> {
    if byte_length == 0 || byte_length > MAX_DOCUMENT_BYTES {
        return Err(ServiceFailure::InvalidDocumentPayload);
    }
    Ok(())
}

pub(crate) fn validate_database_id(database_id: &str) -> ServiceResult<()> {
    let bytes = database_id.as_bytes();
    if bytes.len() != DATABASE_ID_BYTES || !database_id.starts_with("database-") {
        return Err(ServiceFailure::InvalidDocumentPayload);
    }
    let uuid = &bytes[9..];
    let valid = uuid.iter().enumerate().all(|(index, byte)| match index {
        8 | 13 | 18 | 23 => *byte == b'-',
        _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(byte),
    });
    if !valid {
        return Err(ServiceFailure::InvalidDocumentPayload);
    }
    Ok(())
}

pub(crate) fn validate_media_id(media_id: &str) -> ServiceResult<()> {
    if media_id.len() != MEDIA_ID_BYTES
        || !media_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(ServiceFailure::InvalidInput);
    }
    Ok(())
}

pub(crate) fn validate_mime_type(mime_type: &str) -> ServiceResult<()> {
    if mime_type.is_empty()
        || mime_type.len() > MAX_MIME_TYPE_BYTES
        || !mime_type.is_ascii()
        || mime_type.bytes().any(|byte| byte.is_ascii_control())
        || !mime_type.contains('/')
    {
        return Err(ServiceFailure::InvalidInput);
    }
    Ok(())
}

pub(crate) fn validate_media_size(byte_length: usize) -> ServiceResult<()> {
    if byte_length > MAX_DEVELOPMENT_MEDIA_BYTES {
        return Err(ServiceFailure::InvalidInput);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_document_media_and_identifier_limits_are_exact() {
        assert!(validate_password(&vec![b'x'; MAX_PASSWORD_BYTES]).is_ok());
        assert!(matches!(
            validate_password(&[]),
            Err(ServiceFailure::InvalidInput)
        ));
        assert!(matches!(
            validate_password(&vec![b'x'; MAX_PASSWORD_BYTES + 1]),
            Err(ServiceFailure::InvalidInput)
        ));
        assert!(validate_document_size(MAX_DOCUMENT_BYTES).is_ok());
        assert!(validate_document_size(MAX_DOCUMENT_BYTES + 1).is_err());
        assert!(validate_media_size(MAX_DEVELOPMENT_MEDIA_BYTES).is_ok());
        assert!(validate_media_size(MAX_DEVELOPMENT_MEDIA_BYTES + 1).is_err());
        assert!(validate_database_id("database-12345678-1234-1234-1234-1234567890ab").is_ok());
        assert!(validate_database_id("database-12345678-1234-1234-1234-1234567890AB").is_err());
        assert!(validate_mime_type(&format!("a/{}", "b".repeat(MAX_MIME_TYPE_BYTES - 2))).is_ok());
        assert!(validate_mime_type(&format!("a/{}", "b".repeat(MAX_MIME_TYPE_BYTES - 1))).is_err());
    }
}
