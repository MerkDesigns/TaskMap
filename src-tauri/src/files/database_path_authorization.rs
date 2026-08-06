use crate::database::limits::AUTHORIZATION_TOKEN_BYTES;
use crate::phase2_error::{Phase2Failure, Phase2Result};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const AUTHORIZATION_LIFETIME: Duration = Duration::from_secs(15 * 60);
const MAX_PATH_BYTES: usize = 32_767;
const MAX_OUTSTANDING_AUTHORIZATIONS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DatabasePathAuthorizationKind {
    Create,
    Open,
    FullBackup,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AuthorizedDatabasePath {
    pub(crate) authorization_token: String,
    pub(crate) display_path: String,
}

struct AuthorizationEntry {
    path: PathBuf,
    kind: DatabasePathAuthorizationKind,
    edition: String,
    expires_at: Instant,
}

#[derive(Clone)]
pub(crate) struct DatabasePathAuthorizationState {
    entries: Arc<Mutex<HashMap<String, AuthorizationEntry>>>,
    lifetime: Duration,
}

impl Default for DatabasePathAuthorizationState {
    fn default() -> Self {
        Self {
            entries: Arc::new(Mutex::new(HashMap::new())),
            lifetime: AUTHORIZATION_LIFETIME,
        }
    }
}

impl DatabasePathAuthorizationState {
    pub(crate) fn issue(
        &self,
        raw_path: &Path,
        kind: DatabasePathAuthorizationKind,
        edition: &str,
    ) -> Phase2Result<AuthorizedDatabasePath> {
        let path = normalize_path(raw_path, kind)?;
        let token = random_token();
        let mut entries = self.entries.lock().map_err(|_| Phase2Failure::Internal)?;
        entries.retain(|_, entry| entry.expires_at > Instant::now());
        if entries.len() >= MAX_OUTSTANDING_AUTHORIZATIONS {
            return Err(Phase2Failure::PermissionDenied);
        }
        entries.insert(
            token.clone(),
            AuthorizationEntry {
                path: path.clone(),
                kind,
                edition: edition.to_string(),
                expires_at: Instant::now() + self.lifetime,
            },
        );
        Ok(AuthorizedDatabasePath {
            authorization_token: token,
            display_path: path.to_string_lossy().into_owned(),
        })
    }

    pub(crate) fn redeem(
        &self,
        token: &str,
        expected_kind: DatabasePathAuthorizationKind,
        edition: &str,
    ) -> Phase2Result<PathBuf> {
        if token.len() != AUTHORIZATION_TOKEN_BYTES {
            return Err(Phase2Failure::InvalidInput);
        }
        let entry = self
            .entries
            .lock()
            .map_err(|_| Phase2Failure::Internal)?
            .remove(token)
            .ok_or(Phase2Failure::PermissionDenied)?;
        if entry.expires_at <= Instant::now()
            || entry.kind != expected_kind
            || entry.edition != edition
        {
            return Err(Phase2Failure::PermissionDenied);
        }
        Ok(entry.path)
    }
}

fn normalize_path(raw_path: &Path, kind: DatabasePathAuthorizationKind) -> Phase2Result<PathBuf> {
    let raw = raw_path.as_os_str().to_string_lossy();
    if raw.is_empty() || raw.len() > MAX_PATH_BYTES {
        return Err(Phase2Failure::InvalidInput);
    }
    match kind {
        DatabasePathAuthorizationKind::Open => {
            if !has_database_extension(raw_path) {
                return Err(Phase2Failure::InvalidInput);
            }
            let path = std::fs::canonicalize(raw_path).map_err(Phase2Failure::from_io)?;
            if !path.is_file() || !has_database_extension(&path) {
                return Err(Phase2Failure::FileNotFound);
            }
            Ok(path)
        }
        DatabasePathAuthorizationKind::Create | DatabasePathAuthorizationKind::FullBackup => {
            let mut destination = raw_path.to_path_buf();
            match destination.extension() {
                None => {
                    destination.set_extension("tmapdb");
                }
                Some(_) if !has_database_extension(&destination) => {
                    return Err(Phase2Failure::InvalidInput);
                }
                Some(_) => {}
            }
            if destination.as_os_str().to_string_lossy().len() > MAX_PATH_BYTES {
                return Err(Phase2Failure::InvalidInput);
            }
            let file_name = destination.file_name().ok_or(Phase2Failure::InvalidInput)?;
            if Path::new(file_name)
                .components()
                .any(|part| !matches!(part, Component::Normal(_)))
            {
                return Err(Phase2Failure::InvalidInput);
            }
            let parent = destination
                .parent()
                .filter(|path| !path.as_os_str().is_empty());
            let parent = match parent {
                Some(parent) => parent.to_path_buf(),
                None => std::env::current_dir().map_err(Phase2Failure::from_io)?,
            };
            std::fs::create_dir_all(&parent).map_err(Phase2Failure::from_io)?;
            let canonical_parent = std::fs::canonicalize(parent).map_err(Phase2Failure::from_io)?;
            Ok(canonical_parent.join(file_name))
        }
    }
}

fn has_database_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("tmapdb"))
}

fn random_token() -> String {
    let mut bytes = [0_u8; 24];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    #[test]
    fn tokens_are_process_scoped_one_time_and_kind_bound() {
        let directory = tempfile::tempdir().unwrap();
        let state = DatabasePathAuthorizationState::default();
        let authorized = state
            .issue(
                &directory.path().join("new.tmapdb"),
                DatabasePathAuthorizationKind::Create,
                "development",
            )
            .unwrap();
        let other_process_state = DatabasePathAuthorizationState::default();
        assert!(matches!(
            other_process_state.redeem(
                &authorized.authorization_token,
                DatabasePathAuthorizationKind::Create,
                "development"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));
        assert!(matches!(
            state.redeem(
                &authorized.authorization_token,
                DatabasePathAuthorizationKind::Open,
                "development"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));
        assert!(matches!(
            state.redeem(
                &authorized.authorization_token,
                DatabasePathAuthorizationKind::Create,
                "development"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));
    }

    #[test]
    fn tokens_are_edition_bound_expiring_and_cannot_change_paths() {
        let directory = tempfile::tempdir().unwrap();
        let first = directory.path().join("first.tmapdb");
        let second = directory.path().join("second.tmapdb");
        File::create(&first).unwrap();
        File::create(&second).unwrap();
        let state = DatabasePathAuthorizationState::default();
        let authorized = state
            .issue(&first, DatabasePathAuthorizationKind::Open, "development")
            .unwrap();
        assert!(matches!(
            state.redeem(
                &authorized.authorization_token,
                DatabasePathAuthorizationKind::Open,
                "stable"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));

        let authorized = state
            .issue(&first, DatabasePathAuthorizationKind::Open, "development")
            .unwrap();
        assert_eq!(
            state
                .redeem(
                    &authorized.authorization_token,
                    DatabasePathAuthorizationKind::Open,
                    "development"
                )
                .unwrap(),
            std::fs::canonicalize(first).unwrap()
        );
        assert_ne!(authorized.display_path, second.to_string_lossy());

        let expiring = DatabasePathAuthorizationState {
            lifetime: Duration::ZERO,
            ..DatabasePathAuthorizationState::default()
        };
        let expired = expiring
            .issue(&second, DatabasePathAuthorizationKind::Open, "development")
            .unwrap();
        assert!(matches!(
            expiring.redeem(
                &expired.authorization_token,
                DatabasePathAuthorizationKind::Open,
                "development"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));
    }

    #[test]
    fn extension_and_destination_normalization_are_backend_enforced() {
        let directory = tempfile::tempdir().unwrap();
        let state = DatabasePathAuthorizationState::default();
        assert!(state
            .issue(
                &directory.path().join("wrong.sqlite"),
                DatabasePathAuthorizationKind::Create,
                "development"
            )
            .is_err());
        let nested = directory.path().join("new-parent").join("database.TMAPDB");
        let authorized = state
            .issue(
                &nested,
                DatabasePathAuthorizationKind::Create,
                "development",
            )
            .unwrap();
        let redeemed = state
            .redeem(
                &authorized.authorization_token,
                DatabasePathAuthorizationKind::Create,
                "development",
            )
            .unwrap();
        assert!(redeemed.is_absolute());
        assert!(redeemed.parent().unwrap().is_dir());

        let without_extension = state
            .issue(
                &directory.path().join("normalized-name"),
                DatabasePathAuthorizationKind::FullBackup,
                "development",
            )
            .unwrap();
        assert!(without_extension
            .display_path
            .ends_with("normalized-name.tmapdb"));
    }

    #[test]
    fn outstanding_authorizations_are_bounded() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("bounded.tmapdb");
        File::create(&database).unwrap();
        let state = DatabasePathAuthorizationState::default();
        for _ in 0..MAX_OUTSTANDING_AUTHORIZATIONS {
            state
                .issue(
                    &database,
                    DatabasePathAuthorizationKind::Open,
                    "development",
                )
                .unwrap();
        }
        assert!(matches!(
            state.issue(
                &database,
                DatabasePathAuthorizationKind::Open,
                "development"
            ),
            Err(Phase2Failure::PermissionDenied)
        ));
    }
}
