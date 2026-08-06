use crate::crypto::secret_key::SecretKey;
use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use rand::{rngs::OsRng, RngCore};
use zeroize::Zeroizing;

pub(crate) const ENCRYPTION_ALGORITHM: &str = "xchacha20poly1305";
pub(crate) const NONCE_BYTES: usize = 24;
const KEY_CHECK_PLAINTEXT: &[u8] = b"taskmap-key-check-v1";

#[derive(Debug, Clone)]
pub(crate) struct EncryptedPayload {
    pub(crate) nonce: [u8; NONCE_BYTES],
    pub(crate) ciphertext: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CipherFailure {
    InvalidNonce,
    Authentication,
}

pub(crate) fn encrypt(
    key: &SecretKey,
    plaintext: &[u8],
    associated_data: &[u8],
) -> Result<EncryptedPayload, CipherFailure> {
    let cipher = XChaCha20Poly1305::new(key.expose().into());
    let mut nonce = [0_u8; NONCE_BYTES];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: plaintext,
                aad: associated_data,
            },
        )
        .map_err(|_| CipherFailure::Authentication)?;
    Ok(EncryptedPayload { nonce, ciphertext })
}

pub(crate) fn decrypt(
    key: &SecretKey,
    nonce: &[u8],
    ciphertext: &[u8],
    associated_data: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CipherFailure> {
    let nonce: &[u8; NONCE_BYTES] = nonce.try_into().map_err(|_| CipherFailure::InvalidNonce)?;
    XChaCha20Poly1305::new(key.expose().into())
        .decrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: ciphertext,
                aad: associated_data,
            },
        )
        .map(Zeroizing::new)
        .map_err(|_| CipherFailure::Authentication)
}

pub(crate) fn create_key_check(
    key: &SecretKey,
    associated_data: &[u8],
) -> Result<EncryptedPayload, CipherFailure> {
    encrypt(key, KEY_CHECK_PLAINTEXT, associated_data)
}

pub(crate) fn verify_key_check(
    key: &SecretKey,
    nonce: &[u8],
    ciphertext: &[u8],
    associated_data: &[u8],
) -> Result<(), CipherFailure> {
    let plaintext = decrypt(key, nonce, ciphertext, associated_data)?;
    if plaintext.as_slice() == KEY_CHECK_PLAINTEXT {
        Ok(())
    } else {
        Err(CipherFailure::Authentication)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::secret_key::DOCUMENT_KEY_BYTES;

    #[test]
    fn modified_ciphertext_fails_authentication() {
        let key = SecretKey::new([7; DOCUMENT_KEY_BYTES]);
        let mut encrypted = encrypt(&key, b"opaque document", b"metadata").unwrap();
        encrypted.ciphertext[0] ^= 1;

        assert_eq!(
            decrypt(&key, &encrypted.nonce, &encrypted.ciphertext, b"metadata"),
            Err(CipherFailure::Authentication)
        );
    }

    #[test]
    fn repeated_plaintext_uses_distinct_nonce_and_ciphertext() {
        let key = SecretKey::new([9; DOCUMENT_KEY_BYTES]);
        let first = encrypt(&key, b"same", b"metadata").unwrap();
        let second = encrypt(&key, b"same", b"metadata").unwrap();

        assert_ne!(first.nonce, second.nonce);
        assert_ne!(first.ciphertext, second.ciphertext);
    }

    #[test]
    fn rapid_encryptions_never_reuse_a_nonce() {
        use std::collections::HashSet;

        let key = SecretKey::new([3; DOCUMENT_KEY_BYTES]);
        let mut nonces = HashSet::new();
        for _ in 0..1_000 {
            let encrypted = encrypt(&key, b"same", b"same-metadata").unwrap();
            assert!(nonces.insert(encrypted.nonce));
        }
    }

    #[test]
    fn every_document_aad_field_is_authenticated() {
        let key = SecretKey::new([5; DOCUMENT_KEY_BYTES]);
        let original = b"taskmap|document|format=1|schema=1|database=db|revision=7";
        let encrypted = encrypt(&key, b"document", original).unwrap();
        for changed in [
            b"taskmap|document|format=2|schema=1|database=db|revision=7".as_slice(),
            b"taskmap|document|format=1|schema=2|database=db|revision=7".as_slice(),
            b"taskmap|document|format=1|schema=1|database=xx|revision=7".as_slice(),
            b"taskmap|document|format=1|schema=1|database=db|revision=8".as_slice(),
        ] {
            assert_eq!(
                decrypt(&key, &encrypted.nonce, &encrypted.ciphertext, changed),
                Err(CipherFailure::Authentication)
            );
        }
    }
}
