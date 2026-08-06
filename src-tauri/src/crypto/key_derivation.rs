use crate::crypto::secret_key::{SecretKey, DOCUMENT_KEY_BYTES};
use crate::database::limits::validate_password;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use argon2::{Algorithm, Argon2, Block, Params, Version};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

pub(crate) const KDF_ALGORITHM: &str = "argon2id";
pub(crate) const KDF_SALT_BYTES: usize = 16;
pub(crate) const ARGON2_MEMORY_KIB: u32 = 65_536;
pub(crate) const ARGON2_ITERATIONS: u32 = 3;
pub(crate) const ARGON2_PARALLELISM: u32 = 1;
pub(crate) const ARGON2_VERSION: u32 = 0x13;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct KdfParameters {
    pub(crate) memory_kib: u32,
    pub(crate) iterations: u32,
    pub(crate) parallelism: u32,
}

impl Default for KdfParameters {
    fn default() -> Self {
        Self {
            memory_kib: ARGON2_MEMORY_KIB,
            iterations: ARGON2_ITERATIONS,
            parallelism: ARGON2_PARALLELISM,
        }
    }
}

pub(crate) fn derive_key(
    password: &[u8],
    salt: &[u8],
    parameters: KdfParameters,
) -> Phase2Result<SecretKey> {
    validate_password(password)?;
    if salt.len() != KDF_SALT_BYTES || parameters != KdfParameters::default() {
        return Err(Phase2Failure::UnsupportedFormat);
    }

    let params = Params::new(
        parameters.memory_kib,
        parameters.iterations,
        parameters.parallelism,
        Some(DOCUMENT_KEY_BYTES),
    )
    .map_err(|_| Phase2Failure::Crypto)?;
    let block_count = params.block_count();
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut output = Zeroizing::new([0_u8; DOCUMENT_KEY_BYTES]);
    let mut work_memory = Zeroizing::new(vec![Block::default(); block_count]);
    argon2
        .hash_password_into_with_memory(password, salt, output.as_mut(), work_memory.as_mut_slice())
        .map_err(|_| Phase2Failure::Crypto)?;
    Ok(SecretKey::from_zeroizing(output))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malicious_or_unsupported_parameters_are_rejected_before_argon2() {
        let salt = [7_u8; KDF_SALT_BYTES];
        assert!(matches!(
            derive_key(
                b"password",
                &[7_u8; KDF_SALT_BYTES - 1],
                KdfParameters::default()
            ),
            Err(Phase2Failure::UnsupportedFormat)
        ));
        for parameters in [
            KdfParameters {
                memory_kib: u32::MAX,
                ..KdfParameters::default()
            },
            KdfParameters {
                iterations: u32::MAX,
                ..KdfParameters::default()
            },
            KdfParameters {
                parallelism: u32::MAX,
                ..KdfParameters::default()
            },
        ] {
            assert!(matches!(
                derive_key(b"password", &salt, parameters),
                Err(Phase2Failure::UnsupportedFormat)
            ));
        }
    }

    #[test]
    fn unicode_password_bytes_derive_deterministically() {
        let salt = [11_u8; KDF_SALT_BYTES];
        let first =
            derive_key("pässwörd-密碼".as_bytes(), &salt, KdfParameters::default()).unwrap();
        let second =
            derive_key("pässwörd-密碼".as_bytes(), &salt, KdfParameters::default()).unwrap();
        assert_eq!(first.expose(), second.expose());
        assert!(derive_key(b"", &salt, KdfParameters::default()).is_err());
    }
}
