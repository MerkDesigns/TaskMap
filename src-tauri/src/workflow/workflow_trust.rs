use crate::error::{ServiceFailure, ServiceResult};
use crate::settings::settings_file;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const TRUST_FILE: &str = "workflow-trust.json";
const TRUST_FILE_LIMIT: usize = 1024 * 1024;
/// Per database; the oldest trust is forgotten first, so a forgotten workflow needs a new review.
const MAX_TRUSTED_PER_DATABASE: usize = 256;

#[derive(Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TrustFile {
    version: u32,
    /// Database id → trusted definition hashes, oldest first.
    trusted: BTreeMap<String, Vec<String>>,
}

/// The device's record of trusted workflow definitions. It lives beside the device settings, never in
/// a document, so a document cannot mark its own workflows trusted.
#[derive(Default)]
pub(crate) struct WorkflowTrust {
    // Serializes read-modify-write of the trust file.
    file: Mutex<()>,
}

fn trust_path(directory: &Path) -> PathBuf {
    directory.join(TRUST_FILE)
}

fn load(directory: &Path) -> ServiceResult<TrustFile> {
    match settings_file::read(&trust_path(directory), TRUST_FILE_LIMIT)? {
        None => Ok(TrustFile {
            version: 1,
            trusted: BTreeMap::new(),
        }),
        // A damaged or unknown file trusts nothing; the next record replaces it.
        Some(bytes) => Ok(serde_json::from_slice::<TrustFile>(&bytes)
            .ok()
            .filter(|file| file.version == 1)
            .unwrap_or(TrustFile {
                version: 1,
                trusted: BTreeMap::new(),
            })),
    }
}

impl WorkflowTrust {
    pub(crate) fn is_trusted(
        &self,
        directory: &Path,
        database_id: &str,
        hash: &str,
    ) -> ServiceResult<bool> {
        let _file = self.file.lock().map_err(|_| ServiceFailure::Internal)?;
        Ok(load(directory)?
            .trusted
            .get(database_id)
            .is_some_and(|hashes| hashes.iter().any(|trusted| trusted == hash)))
    }

    pub(crate) fn record(
        &self,
        directory: &Path,
        database_id: &str,
        hash: &str,
    ) -> ServiceResult<()> {
        let _file = self.file.lock().map_err(|_| ServiceFailure::Internal)?;
        let mut file = load(directory)?;
        let hashes = file.trusted.entry(database_id.to_string()).or_default();
        hashes.retain(|trusted| trusted != hash);
        hashes.push(hash.to_string());
        if hashes.len() > MAX_TRUSTED_PER_DATABASE {
            let excess = hashes.len() - MAX_TRUSTED_PER_DATABASE;
            hashes.drain(..excess);
        }
        let bytes = serde_json::to_vec(&file).map_err(|_| ServiceFailure::Settings)?;
        settings_file::write(&trust_path(directory), &bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trusts_only_recorded_definitions_of_that_database() {
        let directory = tempfile::tempdir().unwrap();
        let trust = WorkflowTrust::default();
        assert!(!trust
            .is_trusted(directory.path(), "db-a", "hash-1")
            .unwrap());
        trust.record(directory.path(), "db-a", "hash-1").unwrap();
        assert!(trust
            .is_trusted(directory.path(), "db-a", "hash-1")
            .unwrap());
        assert!(!trust
            .is_trusted(directory.path(), "db-b", "hash-1")
            .unwrap());
        assert!(!trust
            .is_trusted(directory.path(), "db-a", "hash-2")
            .unwrap());
    }

    #[test]
    fn forgets_the_oldest_trust_beyond_the_limit() {
        let directory = tempfile::tempdir().unwrap();
        let trust = WorkflowTrust::default();
        for index in 0..=MAX_TRUSTED_PER_DATABASE {
            trust
                .record(directory.path(), "db", &format!("hash-{index}"))
                .unwrap();
        }
        assert!(!trust.is_trusted(directory.path(), "db", "hash-0").unwrap());
        assert!(trust.is_trusted(directory.path(), "db", "hash-1").unwrap());
    }

    #[test]
    fn treats_a_damaged_file_as_trusting_nothing() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(trust_path(directory.path()), b"{not json").unwrap();
        let trust = WorkflowTrust::default();
        assert!(!trust.is_trusted(directory.path(), "db", "hash").unwrap());
        trust.record(directory.path(), "db", "hash").unwrap();
        assert!(trust.is_trusted(directory.path(), "db", "hash").unwrap());
    }
}
