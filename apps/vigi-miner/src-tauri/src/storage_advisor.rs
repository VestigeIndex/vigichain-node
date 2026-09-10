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

fn policy(free: u64, represented: u64) -> (&'static str, &'static str, &'static str) {
    let critical = free < 20 * GIB || (represented > 0 && free < represented / 2);
    let elevated = free < 80 * GIB || (represented > 0 && free < represented);
    if critical {
        (
            "maximum",
            "critical",
            "Free storage is low relative to Vigi data. Maximum compression is recommended.",
        )
    } else if elevated {
        (
            "automatic",
            "elevated",
            "Storage headroom is limited. Automatic compaction is recommended.",
        )
    } else {
        ("automatic", "normal", "Storage headroom is healthy. Automatic compaction preserves space without aggressive CPU use.")
    }
}

pub fn advise(home: &Path, represented_bytes: u64) -> Result<StorageAdvice, String> {
    fs::create_dir_all(home).map_err(|e| format!("Unable to prepare Vigi storage root: {e}"))?;
    let free = available_space(home).map_err(|e| format!("Unable to read free disk space: {e}"))?;
    let (mode, pressure, reason) = policy(free, represented_bytes);
    Ok(StorageAdvice {
        free_bytes: free,
        represented_bytes,
        recommended_mode: mode.into(),
        pressure: pressure.into(),
        reason: reason.into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn critical_space_selects_maximum() {
        let (mode, pressure, _) = policy(10 * GIB, 50 * GIB);
        assert_eq!(mode, "maximum");
        assert_eq!(pressure, "critical");
    }

    #[test]
    fn moderate_space_selects_automatic() {
        let (mode, pressure, _) = policy(60 * GIB, 30 * GIB);
        assert_eq!(mode, "automatic");
        assert_eq!(pressure, "elevated");
    }

    #[test]
    fn healthy_space_stays_automatic() {
        let (mode, pressure, _) = policy(300 * GIB, 40 * GIB);
        assert_eq!(mode, "automatic");
        assert_eq!(pressure, "normal");
    }
}
