use crate::crypto::secret_key::SecretKey;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::time::{Duration, Instant};

pub(crate) const PENDING_UNLOCK_TIMEOUT: Duration = Duration::from_secs(60);

pub(super) enum SessionKeyState {
    Locked,
    Pending {
        key: SecretKey,
        confirmation_token: String,
        expires_at: Instant,
    },
    Unlocked(SecretKey),
}

impl SessionKeyState {
    pub(super) fn pending(key: SecretKey, confirmation_token: String) -> Self {
        Self::Pending {
            key,
            confirmation_token,
            expires_at: Instant::now() + PENDING_UNLOCK_TIMEOUT,
        }
    }

    pub(super) fn unlocked_key(&self) -> Phase2Result<&SecretKey> {
        match self {
            Self::Unlocked(key) => Ok(key),
            Self::Locked | Self::Pending { .. } => Err(Phase2Failure::SessionLocked),
        }
    }

    pub(super) fn confirm(&mut self, token: &str) -> Phase2Result<()> {
        let candidate = std::mem::replace(self, Self::Locked);
        match candidate {
            Self::Pending {
                key,
                confirmation_token,
                expires_at,
            } if confirmation_token == token && Instant::now() <= expires_at => {
                *self = Self::Unlocked(key);
                Ok(())
            }
            _ => Err(Phase2Failure::SessionLocked),
        }
    }

    pub(super) fn pending_matches(&self, token: &str) -> bool {
        matches!(
            self,
            Self::Pending {
                confirmation_token,
                ..
            } if confirmation_token == token
        )
    }

    pub(super) fn pending_expired(&self, token: &str) -> bool {
        matches!(
            self,
            Self::Pending {
                confirmation_token,
                expires_at,
                ..
            } if confirmation_token == token && Instant::now() >= *expires_at
        )
    }

    pub(super) fn clear(&mut self) {
        let mut previous = std::mem::replace(self, Self::Locked);
        match &mut previous {
            Self::Pending { key, .. } | Self::Unlocked(key) => key.clear(),
            Self::Locked => {}
        }
    }

    pub(super) fn is_pending(&self) -> bool {
        matches!(self, Self::Pending { .. })
    }

    pub(super) fn is_locked(&self) -> bool {
        matches!(self, Self::Locked)
    }

    pub(super) fn is_unlocked(&self) -> bool {
        matches!(self, Self::Unlocked(_))
    }

    #[cfg(test)]
    pub(super) fn force_pending_expired(&mut self) {
        if let Self::Pending { expires_at, .. } = self {
            *expires_at = Instant::now() - Duration::from_secs(1);
        }
    }
}
