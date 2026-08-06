use zeroize::{Zeroize, Zeroizing};

pub(crate) const DOCUMENT_KEY_BYTES: usize = 32;

pub(crate) struct SecretKey(Zeroizing<[u8; DOCUMENT_KEY_BYTES]>);

impl SecretKey {
    #[cfg(test)]
    pub(crate) fn new(bytes: [u8; DOCUMENT_KEY_BYTES]) -> Self {
        Self(Zeroizing::new(bytes))
    }

    pub(crate) fn from_zeroizing(bytes: Zeroizing<[u8; DOCUMENT_KEY_BYTES]>) -> Self {
        Self(bytes)
    }

    pub(crate) fn expose(&self) -> &[u8; DOCUMENT_KEY_BYTES] {
        &self.0
    }

    pub(crate) fn clear(&mut self) {
        self.0.zeroize();
    }

    #[cfg(test)]
    pub(crate) fn is_cleared(&self) -> bool {
        self.0.iter().all(|byte| *byte == 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_buffer_uses_zeroizing_ownership_and_can_be_cleared() {
        let mut key = SecretKey::new([42; DOCUMENT_KEY_BYTES]);
        assert!(!key.is_cleared());
        key.clear();
        assert!(key.is_cleared());
    }
}
