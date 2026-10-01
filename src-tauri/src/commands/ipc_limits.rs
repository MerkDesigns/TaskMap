use crate::error::{CommandError, CommandResult, ServiceFailure};
use serde::de::DeserializeOwned;
use tauri::ipc::{InvokeBody, Request};

pub(crate) const MAX_SMALL_IPC_BYTES: usize = 64 * 1024;
pub(crate) const MAX_DOCUMENT_IPC_BYTES: usize =
    crate::database::limits::MAX_DOCUMENT_BYTES + MAX_SMALL_IPC_BYTES;

pub(crate) fn deserialize_limited<T: DeserializeOwned>(
    request: &Request<'_>,
    maximum_bytes: usize,
) -> CommandResult<T> {
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) if bytes.len() <= maximum_bytes => bytes,
        InvokeBody::Raw(_) | InvokeBody::Json(_) => {
            return Err(CommandError::from(ServiceFailure::InvalidInput));
        }
    };
    deserialize_slice_limited(bytes, maximum_bytes)
}

pub(crate) fn deserialize_slice_limited<T: DeserializeOwned>(
    bytes: &[u8],
    maximum_bytes: usize,
) -> CommandResult<T> {
    if bytes.len() > maximum_bytes {
        return Err(CommandError::from(ServiceFailure::InvalidInput));
    }
    serde_json::from_slice(bytes).map_err(|_| CommandError::from(ServiceFailure::InvalidInput))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Input {
        value: String,
    }

    #[test]
    fn rejects_before_deserializing_an_oversized_payload() {
        let bytes = br#"{"value":"small"}"#;
        assert!(deserialize_slice_limited::<Input>(bytes, bytes.len() - 1).is_err());
        let decoded = deserialize_slice_limited::<Input>(bytes, bytes.len()).unwrap();
        assert_eq!(decoded.value, "small");
    }
}
