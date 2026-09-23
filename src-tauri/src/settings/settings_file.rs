use crate::phase2_error::{Phase2Failure, Phase2Result};
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::Path;

pub(crate) fn read(path: &Path, limit: usize) -> Phase2Result<Option<Vec<u8>>> {
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(Phase2Failure::from_io(error)),
    };
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(Phase2Failure::from_io)?;
    if bytes.len() > limit {
        return Err(Phase2Failure::Settings);
    }
    Ok(Some(bytes))
}

pub(crate) fn write(path: &Path, bytes: &[u8]) -> Phase2Result<()> {
    let parent = path.parent().ok_or(Phase2Failure::Settings)?;
    std::fs::create_dir_all(parent).map_err(Phase2Failure::from_io)?;
    let temporary = path.with_extension(format!(
        "tmp-{}-{}",
        std::process::id(),
        rand::random::<u64>()
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(Phase2Failure::from_io)?;
        file.write_all(bytes).map_err(Phase2Failure::from_io)?;
        file.sync_all().map_err(Phase2Failure::from_io)?;
        drop(file);
        super::recent_databases::atomic_replace(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}
