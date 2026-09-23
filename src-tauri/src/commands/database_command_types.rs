use serde::Deserialize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateDatabaseInput {
    pub(crate) authorization_token: String,
    pub(crate) database_id: String,
    pub(crate) document_schema_version: i64,
    pub(crate) serialized_document: String,
    pub(crate) password: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenDatabaseInput {
    pub(crate) authorization_token: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct UnlockDatabaseInput {
    pub(crate) password: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmUnlockInput {
    pub(crate) confirmation_token: String,
    pub(crate) database_id: String,
    pub(crate) database_purpose: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CancelPendingUnlockInput {
    pub(crate) confirmation_token: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveDocumentInput {
    pub(crate) session_id: String,
    pub(crate) serialized_document: String,
    pub(crate) expected_revision: i64,
    pub(crate) database_id: String,
    pub(crate) database_purpose: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FullBackupInput {
    pub(crate) authorization_token: String,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DatabasePathMode {
    Create,
    Open,
    FullBackup,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ChooseDatabasePathInput {
    pub(crate) mode: DatabasePathMode,
}

#[cfg(test)]
mod tests {
    use super::super::phase2_ipc::{deserialize_slice_limited, MAX_SMALL_IPC_BYTES};
    use super::*;
    #[test]
    fn raw_paths_and_missing_session_authority_are_not_accepted() {
        for bytes in [
            br#"{"databasePath":"test.tmapdb"}"#.as_slice(),
            br#"{"authorizationToken":"token","databasePath":"test.tmapdb"}"#.as_slice(),
        ] {
            assert!(
                deserialize_slice_limited::<OpenDatabaseInput>(bytes, MAX_SMALL_IPC_BYTES).is_err()
            );
        }
        assert!(deserialize_slice_limited::<SaveDocumentInput>(
            br#"{"serializedDocument":"{}","expectedRevision":1,"databaseId":"id","databasePurpose":"production"}"#,
            MAX_SMALL_IPC_BYTES
        ).is_err());
    }
}
