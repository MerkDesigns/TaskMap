use crate::error::{ServiceFailure, ServiceResult};
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::Path;

pub(crate) fn read(path: &Path, limit: usize) -> ServiceResult<Option<Vec<u8>>> {
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(ServiceFailure::from_io(error)),
    };
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(ServiceFailure::from_io)?;
    if bytes.len() > limit {
        return Err(ServiceFailure::Settings);
    }
    Ok(Some(bytes))
}

pub(crate) fn write(path: &Path, bytes: &[u8]) -> ServiceResult<()> {
    let parent = path.parent().ok_or(ServiceFailure::Settings)?;
    std::fs::create_dir_all(parent).map_err(ServiceFailure::from_io)?;
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
            .map_err(ServiceFailure::from_io)?;
        file.write_all(bytes).map_err(ServiceFailure::from_io)?;
        file.sync_all().map_err(ServiceFailure::from_io)?;
        drop(file);
        super::recent_databases::atomic_replace(&temporary, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}
