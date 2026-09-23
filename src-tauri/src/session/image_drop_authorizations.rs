use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use std::{
    collections::HashMap,
    path::PathBuf,
    time::{Duration, Instant},
};

struct Entry {
    path: PathBuf,
    database: String,
    session: String,
    created: Instant,
}
#[derive(Default)]
pub(crate) struct ImageDropAuthorizations(HashMap<String, Entry>);
impl ImageDropAuthorizations {
    // Only called from a native main-window drop, never from renderer-supplied paths.
    pub(crate) fn issue(
        &mut self,
        paths: &[PathBuf],
        database: &str,
        session: &str,
    ) -> Vec<String> {
        let entries = &mut self.0;
        entries.clear();
        paths
            .iter()
            .take(32)
            .map(|path| {
                let mut bytes = [0u8; 24];
                OsRng.fill_bytes(&mut bytes);
                let token = URL_SAFE_NO_PAD.encode(bytes);
                entries.insert(
                    token.clone(),
                    Entry {
                        path: path.clone(),
                        database: database.into(),
                        session: session.into(),
                        created: Instant::now(),
                    },
                );
                token
            })
            .collect()
    }
    pub(crate) fn take(&mut self, token: &str, database: &str, session: &str) -> Option<PathBuf> {
        let entries = &mut self.0;
        entries.retain(|_, entry| entry.created.elapsed() < Duration::from_secs(60));
        let entry = entries.remove(token)?;
        (entry.database == database && entry.session == session).then_some(entry.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn drops_are_bounded_one_use_session_bound_and_replaced_by_the_next_drop() {
        let mut owner = ImageDropAuthorizations::default();
        let paths = vec![PathBuf::from("fixture.gif"); 50];
        let tokens = owner.issue(&paths, "db", "session");
        assert_eq!(tokens.len(), 32);
        assert!(owner.take(&tokens[0], "db", "other").is_none());
        assert!(owner.take(&tokens[0], "db", "session").is_none());
        assert_eq!(
            owner.take(&tokens[1], "db", "session"),
            Some(paths[0].clone())
        );
        assert!(owner.take(&tokens[1], "db", "session").is_none());
        owner.issue(&paths, "db", "session");
        assert!(owner.take(&tokens[2], "db", "session").is_none());
    }
    #[test]
    fn expired_tokens_cannot_authorize_a_file() {
        let mut owner = ImageDropAuthorizations::default();
        let token = owner
            .issue(&[PathBuf::from("fixture.gif")], "db", "session")
            .remove(0);
        owner.0.get_mut(&token).unwrap().created = Instant::now() - Duration::from_secs(61);
        assert!(owner.take(&token, "db", "session").is_none());
    }
}
