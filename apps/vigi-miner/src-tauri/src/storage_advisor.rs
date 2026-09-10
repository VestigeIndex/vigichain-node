use fs2::available_space;
use serde::Serialize;
use std::{fs, path::Path};

const GIB: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageAdvice {
    pub free_bytes: u64,
    pub represented_bytes: u64,
    pub recommended_mode: String,
    pub pressure: String,
    pub reason: String,
}

pub fn advise(home: &Path, represented_bytes: u64) -> Result<StorageAdvice, String> {
    fs::create_dir_all(home).map_err(|e| format!("Unable to prepare Vigi storage root: {e}"))?;
    let free = available_space(home).map_err(|e| format!("Unable to read free disk space: {e}"))?;

    let critical = free < 20 * GIB || (represented_bytes > 0 && free < represented_bytes / 2);
    let elevated = free < 80 * GIB || (represented_bytes > 0 && free < represented_bytes);

    let (mode, pressure, reason) = if critical {
        ("maximum", "critical", "Free storage is low relative to Vigi data. Maximum compression is recommended.")
    } else if elevated {
        ("automatic", "elevated", "Storage headroom is limited. Automatic compaction is recommended.")
    } else {
        ("automatic", "normal", "Storage headroom is healthy. Automatic compaction preserves space without aggressive CPU use.")
    };

    Ok(StorageAdvice {
        free_bytes: free,
        represented_bytes,
        recommended_mode: mode.into(),
        pressure: pressure.into(),
        reason: reason.into(),
    })
}
