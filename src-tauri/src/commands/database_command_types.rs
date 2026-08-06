use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateDatabaseInput {
    pub(crate) authorization_token: String,
    pub(crate) database_id: String,
    pub(crate) document_schema_version: i64,
    pub(crate) serialized_document: String,
    pub(crate) password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenDatabaseInput {
    pub(crate) authorization_token: String,
}

#[derive(Deserialize)]
pub(crate) struct UnlockDatabaseInput {
    pub(crate) password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfirmUnlockInput {
    pub(crate) confirmation_token: String,
    pub(crate) database_id: String,
    pub(crate) database_purpose: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CancelPendingUnlockInput {
    pub(crate) confirmation_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveDocumentInput {
    pub(crate) serialized_document: String,
    pub(crate) expected_revision: i64,
    pub(crate) database_id: String,
    pub(crate) database_purpose: String,
}

#[derive(Deserialize)]
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
pub(crate) struct ChooseDatabasePathInput {
    pub(crate) mode: DatabasePathMode,
}
