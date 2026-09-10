use std::{fs, path::PathBuf, process::Command};

pub struct SandboxPaths {
    pub root: PathBuf,
    pub data: PathBuf,
    pub temp: PathBuf,
}

pub fn prepare(network: &str) -> Result<SandboxPaths, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or("Unable to resolve user home directory")?;
    let root = PathBuf::from(home).join(".vigichain").join("sandbox").join(network);
    let data = root.join("data");
    let temp = root.join("tmp");
    fs::create_dir_all(&data).map_err(|e| format!("Unable to create sandbox data dir: {e}"))?;
    fs::create_dir_all(&temp).map_err(|e| format!("Unable to create sandbox temp dir: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Unable to restrict sandbox permissions: {e}"))?;
        fs::set_permissions(&data, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Unable to restrict sandbox data permissions: {e}"))?;
        fs::set_permissions(&temp, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Unable to restrict sandbox temp permissions: {e}"))?;
    }

    Ok(SandboxPaths { root, data, temp })
}

pub fn apply_baseline(command: &mut Command, paths: &SandboxPaths) {
    // Do not leak the parent application's environment into the miner. Only a minimal
    // OS-compatible subset is copied back. Mining-specific values are added by the caller.
    let path = std::env::var_os("PATH");
    let system_root = std::env::var_os("SYSTEMROOT");
    let windir = std::env::var_os("WINDIR");

    command.env_clear();
    if let Some(value) = path { command.env("PATH", value); }
    if let Some(value) = system_root { command.env("SYSTEMROOT", value); }
    if let Some(value) = windir { command.env("WINDIR", value); }

    command
        .current_dir(&paths.root)
        .env("VIGI_DATA_DIR", &paths.data)
        .env("TMP", &paths.temp)
        .env("TEMP", &paths.temp)
        .env("VIGI_SANDBOX", "1")
        .env("VIGI_SANDBOX_ROOT", &paths.root);
}
