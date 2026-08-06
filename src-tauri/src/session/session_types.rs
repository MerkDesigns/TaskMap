use serde::{Serialize, Serializer};
use std::fmt;
use std::ops::Deref;
use zeroize::Zeroizing;

pub(crate) struct SensitiveDocument(Zeroizing<String>);

impl SensitiveDocument {
    pub(crate) fn new(value: String) -> Self {
        Self(Zeroizing::new(value))
    }

    pub(crate) fn copy_from_utf8(value: &[u8]) -> Result<Self, std::str::Utf8Error> {
        let value = std::str::from_utf8(value)?;
        let mut owned = Zeroizing::new(String::with_capacity(value.len()));
        owned.push_str(value);
        Ok(Self(owned))
    }
}

impl Deref for SensitiveDocument {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        self.0.as_str()
    }
}

impl Serialize for SensitiveDocument {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self)
    }
}

impl fmt::Debug for SensitiveDocument {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("<redacted document>")
    }
}

impl PartialEq<&str> for SensitiveDocument {
    fn eq(&self, other: &&str) -> bool {
        self.0.as_str() == *other
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DatabaseSessionPhase {
    Closed,
    Locked,
    PendingUnlock,
    Unlocked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseSessionStatus {
    pub(crate) phase: DatabaseSessionPhase,
    pub(crate) session_id: Option<String>,
    pub(crate) database_path: Option<String>,
    pub(crate) database_id: Option<String>,
    pub(crate) document_schema_version: Option<i64>,
    pub(crate) revision: Option<i64>,
    pub(crate) last_activity_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoadedDocument {
    pub(crate) serialized_document: SensitiveDocument,
    pub(crate) revision: i64,
    pub(crate) session: DatabaseSessionStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingLoadedDocument {
    pub(crate) serialized_document: SensitiveDocument,
    pub(crate) revision: i64,
    pub(crate) session: DatabaseSessionStatus,
    pub(crate) confirmation_token: String,
    pub(crate) recovered_from_revision: Option<i64>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SavedDocument {
    pub(crate) revision: i64,
    pub(crate) session: DatabaseSessionStatus,
}

#[cfg(feature = "phase2-development")]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionOperation {
    pub(crate) session: DatabaseSessionStatus,
    pub(crate) warnings: Vec<String>,
}
