use minisign_verify::{PublicKey, Signature};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::State;

const RELEASE_API: &str = "https://api.github.com/repos/VestigeIndex/vigichain-node/releases/latest";
const RELEASE_PUBLIC_KEY: &str = "RWQItT0J/YGNHI45GYmzWqVLUP+fMp5GXIbKxjp7eH/l7vZLfhv7KUsa";
const PROVENANCE_NAME: &str = "VIGICHAIN-PROVENANCE.json";
const SBOM_NAME: &str = "SBOM.cdx.json";
const STATEMENT_TYPE: &str = "https://in-toto.io/Statement/v1";
const PREDICATE_PREFIX: &str = "https://slsa.dev/provenance/";

struct MinerProcess(Mutex<Option<Child>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MinerConfig {
    address: String,
    threads: u16,
    bootnodes: String,
    network: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeStatus {
    running: bool,
    pid: Option<u32>,
    binary_available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfo {
    logical_cpus: usize,
    architecture: String,
    operating_system: String,
    node_binary_available: bool,
    node_binary_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallResult {
    tag: String,
    artifact: String,
    sha256: String,
    source_commit: String,
    builder: String,
    sbom_components: usize,
    installed_path: String,
    verified: bool,
}

fn vigi_home() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or("Unable to resolve user home directory")?;
    Ok(PathBuf::from(home).join(".vigichain"))
}

fn node_binary_name() -> Result<&'static str, String> {
    if std::env::consts::ARCH != "x86_64" {
        return Err(format!(
            "Vigi Miner currently has no signed node artifact for architecture {}",
            std::env::consts::ARCH
        ));
    }
    match std::env::consts::OS {
        "windows" => Ok("vigichain-node-windows-x86_64.exe"),
        "linux" => Ok("vigichain-node-linux-x86_64"),
        other => Err(format!("No signed VigiChain node artifact is published for {other}")),
    }
}

fn node_binary_path() -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("VIGI_NODE_BINARY") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Ok(path);
        }
        return Err("VIGI_NODE_BINARY points to a missing file".into());
    }
    let base = vigi_home()?;
    let canonical = base.join(node_binary_name()?);
    if canonical.exists() {
        return Ok(canonical);
    }
    let fallback = if cfg!(windows) { base.join("vigichain-node.exe") } else { base.join("vigichain-node") };
    if fallback.exists() {
        return Ok(fallback);
    }
    Err("Verified VigiChain node binary not found. Install a verified release from Vigi Miner first.".into())
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("VigiMiner/0.2 (+https://vigichain.org)")
        .connect_timeout(Duration::from_secs(12))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Unable to initialize secure downloader: {e}"))
}

fn get_latest_release(client: &Client) -> Result<GithubRelease, String> {
    client
        .get(RELEASE_API)
        .send()
        .map_err(|e| format!("Unable to query VigiChain releases: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Release API refused the request: {e}"))?
        .json::<GithubRelease>()
        .map_err(|e| format!("Release metadata is not valid JSON: {e}"))
}

fn asset_url<'a>(release: &'a GithubRelease, name: &str) -> Result<&'a str, String> {
    release.assets.iter().find(|a| a.name == name)
        .map(|a| a.browser_download_url.as_str())
        .ok_or_else(|| format!("Release {} is incomplete: missing {name}", release.tag_name))
}

fn download(client: &Client, url: &str, dest: &Path) -> Result<(), String> {
    let bytes = client.get(url).send()
        .map_err(|e| format!("Download failed for {url}: {e}"))?
        .error_for_status().map_err(|e| format!("Server refused download {url}: {e}"))?
        .bytes().map_err(|e| format!("Unable to read downloaded bytes: {e}"))?;
    if bytes.is_empty() { return Err(format!("Downloaded artifact {} is empty", dest.display())); }
    let mut file = fs::File::create(dest).map_err(|e| format!("Unable to create {}: {e}", dest.display()))?;
    file.write_all(&bytes).map_err(|e| format!("Unable to write {}: {e}", dest.display()))
}

fn verify_signature(data: &[u8], signature_text: &str) -> Result<(), String> {
    let pk = PublicKey::from_base64(RELEASE_PUBLIC_KEY)
        .map_err(|e| format!("Embedded VigiChain release key is invalid: {e}"))?;
    let sig = Signature::decode(signature_text)
        .map_err(|e| format!("Release signature cannot be decoded: {e}"))?;
    pk.verify(data, &sig, false).map_err(|e| format!("Release signature verification failed: {e}"))
}

fn sha256_hex(data: &[u8]) -> String { format!("{:x}", Sha256::digest(data)) }

fn verify_manifest(manifest: &str, artifact: &str, digest: &str) -> Result<(), String> {
    let matches: Vec<&str> = manifest.lines().filter(|line| {
        let mut parts = line.split_whitespace();
        matches!(parts.next(), Some(hash) if hash.eq_ignore_ascii_case(digest))
            && matches!(parts.next(), Some(name) if name.trim_start_matches('*') == artifact)
    }).collect();
    if matches.len() != 1 {
        return Err(format!("Signed SHA256SUMS must bind {artifact} to {digest} exactly once; found {} entries", matches.len()));
    }
    Ok(())
}

fn parse_provenance(doc: &Value, artifact: &str, digest: &str, tag: &str) -> Result<(String, String), String> {
    if doc.get("_type").and_then(Value::as_str) != Some(STATEMENT_TYPE) { return Err("Unexpected provenance statement type".into()); }
    let predicate_type = doc.get("predicateType").and_then(Value::as_str).unwrap_or("");
    if !predicate_type.starts_with(PREDICATE_PREFIX) { return Err("Unexpected provenance predicate type".into()); }
    let subjects = doc.get("subject").and_then(Value::as_array).ok_or("Provenance has no subjects")?;
    let mine: Vec<&Value> = subjects.iter().filter(|s| s.get("name").and_then(Value::as_str) == Some(artifact)).collect();
    if mine.len() != 1 { return Err(format!("Provenance must name {artifact} exactly once")); }
    let claimed = mine[0].pointer("/digest/sha256").and_then(Value::as_str).ok_or("Provenance subject has no sha256 digest")?;
    if !claimed.eq_ignore_ascii_case(digest) { return Err("Provenance digest does not match downloaded binary".into()); }

    let external = doc.pointer("/predicate/buildDefinition/externalParameters").ok_or("Provenance has no external parameters")?;
    let reference = external.get("ref").and_then(Value::as_str).unwrap_or("");
    if reference != format!("refs/tags/{tag}") { return Err(format!("Provenance is bound to {reference}, not release tag {tag}")); }
    if external.get("repository").and_then(Value::as_str).unwrap_or("").is_empty() { return Err("Provenance does not name the source repository".into()); }

    let dependencies = doc.pointer("/predicate/buildDefinition/resolvedDependencies").and_then(Value::as_array).ok_or("Provenance resolves no source dependency")?;
    let mut commits: Vec<String> = dependencies.iter()
        .filter_map(|d| d.pointer("/digest/gitCommit").and_then(Value::as_str))
        .map(|s| s.to_ascii_lowercase()).collect();
    commits.sort(); commits.dedup();
    if commits.len() != 1 || commits[0].len() != 40 || !commits[0].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Provenance must resolve exactly one full 40-character source commit".into());
    }
    let builder = doc.pointer("/predicate/runDetails/builder/id").and_then(Value::as_str).unwrap_or("").to_string();
    if builder.is_empty() { return Err("Provenance does not name the builder".into()); }
    Ok((commits.remove(0), builder))
}

fn verify_sbom(sbom_bytes: &[u8], provenance: &Value) -> Result<usize, String> {
    let sbom: Value = serde_json::from_slice(sbom_bytes).map_err(|e| format!("SBOM is not valid JSON: {e}"))?;
    if sbom.get("bomFormat").and_then(Value::as_str) != Some("CycloneDX") { return Err("Dependency inventory is not CycloneDX".into()); }
    let components = sbom.get("components").and_then(Value::as_array).ok_or("SBOM lists no components")?;
    if components.is_empty() { return Err("SBOM lists no components".into()); }
    let actual = sha256_hex(sbom_bytes);
    let mut bound: Option<String> = None;
    if let Some(byproducts) = provenance.pointer("/predicate/runDetails/byproducts").and_then(Value::as_array) {
        for item in byproducts {
            if item.get("name").and_then(Value::as_str) == Some(SBOM_NAME) {
                bound = item.pointer("/digest/sha256").and_then(Value::as_str).map(str::to_string);
            }
        }
    }
    if let Some(subjects) = provenance.get("subject").and_then(Value::as_array) {
        for item in subjects {
            if item.get("name").and_then(Value::as_str) == Some(SBOM_NAME) {
                bound = item.pointer("/digest/sha256").and_then(Value::as_str).map(str::to_string);
            }
        }
    }
    if let Some(expected) = bound {
        if !expected.eq_ignore_ascii_case(&actual) { return Err("Provenance-bound SBOM digest does not match the downloaded inventory".into()); }
    }
    Ok(components.len())
}

#[tauri::command]
fn install_verified_node() -> Result<InstallResult, String> {
    let client = http_client()?;
    let release = get_latest_release(&client)?;
    if !release.tag_name.ends_with("-testnet") { return Err(format!("Refusing unexpected release channel {}", release.tag_name)); }
    let artifact = node_binary_name()?.to_string();
    let binary_sig_name = format!("{artifact}.sig");
    let required = [artifact.as_str(), binary_sig_name.as_str(), "SHA256SUMS", "SHA256SUMS.sig", PROVENANCE_NAME, "VIGICHAIN-PROVENANCE.json.sig", SBOM_NAME];
    for name in required { let _ = asset_url(&release, name)?; }

    let home = vigi_home()?;
    fs::create_dir_all(&home).map_err(|e| format!("Unable to create {}: {e}", home.display()))?;
    let staging = home.join(format!(".install-{}-{}", release.tag_name, std::process::id()));
    if staging.exists() { fs::remove_dir_all(&staging).map_err(|e| format!("Unable to clear stale staging directory: {e}"))?; }
    fs::create_dir(&staging).map_err(|e| format!("Unable to create staging directory: {e}"))?;

    let install = (|| -> Result<InstallResult, String> {
        for name in required { download(&client, asset_url(&release, name)?, &staging.join(name))?; }
        let binary = fs::read(staging.join(&artifact)).map_err(|e| format!("Unable to read downloaded node: {e}"))?;
        let binary_sig = fs::read_to_string(staging.join(&binary_sig_name)).map_err(|e| format!("Unable to read node signature: {e}"))?;
        verify_signature(&binary, &binary_sig)?;

        let sums = fs::read(staging.join("SHA256SUMS")).map_err(|e| format!("Unable to read SHA256SUMS: {e}"))?;
        let sums_sig = fs::read_to_string(staging.join("SHA256SUMS.sig")).map_err(|e| format!("Unable to read SHA256SUMS signature: {e}"))?;
        verify_signature(&sums, &sums_sig)?;
        let provenance_bytes = fs::read(staging.join(PROVENANCE_NAME)).map_err(|e| format!("Unable to read provenance: {e}"))?;
        let provenance_sig = fs::read_to_string(staging.join("VIGICHAIN-PROVENANCE.json.sig")).map_err(|e| format!("Unable to read provenance signature: {e}"))?;
        verify_signature(&provenance_bytes, &provenance_sig)?;

        let digest = sha256_hex(&binary);
        let manifest = String::from_utf8(sums).map_err(|_| "SHA256SUMS is not UTF-8")?;
        verify_manifest(&manifest, &artifact, &digest)?;
        let provenance: Value = serde_json::from_slice(&provenance_bytes).map_err(|e| format!("Provenance is not valid JSON: {e}"))?;
        let (commit, builder) = parse_provenance(&provenance, &artifact, &digest, &release.tag_name)?;
        let sbom_bytes = fs::read(staging.join(SBOM_NAME)).map_err(|e| format!("Unable to read SBOM: {e}"))?;
        let sbom_components = verify_sbom(&sbom_bytes, &provenance)?;

        let destination = home.join(&artifact);
        let pending = home.join(format!(".{artifact}.verified"));
        fs::write(&pending, &binary).map_err(|e| format!("Unable to stage verified node: {e}"))?;
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&pending, fs::Permissions::from_mode(0o700)).map_err(|e| format!("Unable to set node permissions: {e}"))?;
        }
        if destination.exists() { fs::remove_file(&destination).map_err(|e| format!("Unable to replace existing node: {e}"))?; }
        fs::rename(&pending, &destination).map_err(|e| format!("Unable to activate verified node: {e}"))?;
        fs::write(home.join("installed-release.txt"), format!("{}\n{}\n{}\n", release.tag_name, digest, commit))
            .map_err(|e| format!("Unable to record installed release: {e}"))?;

        Ok(InstallResult { tag: release.tag_name.clone(), artifact: artifact.clone(), sha256: digest, source_commit: commit, builder, sbom_components, installed_path: destination.display().to_string(), verified: true })
    })();
    let _ = fs::remove_dir_all(&staging);
    install
}

#[tauri::command]
fn system_info() -> SystemInfo {
    let logical_cpus = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let binary = node_binary_path().ok();
    SystemInfo { logical_cpus, architecture: std::env::consts::ARCH.to_string(), operating_system: std::env::consts::OS.to_string(), node_binary_available: binary.is_some(), node_binary_path: binary.map(|p| p.display().to_string()) }
}

#[tauri::command]
fn start_mining(config: MinerConfig, process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    if config.network == "mainnet" { return Err("Mainnet is visible in Vigi Miner but remains locked while VigiChain Core reports MAINNET_LAUNCHED=false".into()); }
    if config.network != "testnet" { return Err("Unknown VigiChain network".into()); }
    if !config.address.starts_with("tvigi1") { return Err("Testnet reward address must start with tvigi1".into()); }
    if config.threads == 0 { return Err("Mining threads must be greater than zero".into()); }
    let available_threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    if usize::from(config.threads) > available_threads { return Err(format!("Requested {} mining threads but this system exposes only {} logical CPUs", config.threads, available_threads)); }

    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() { return Ok(NodeStatus { running: true, pid: Some(child.id()), binary_available: true }); }
        *guard = None;
    }
    let binary = node_binary_path()?;
    let child = Command::new(binary)
        .env("VIGI_NETWORK", "testnet")
        .env("VIGI_ENABLE_MINING", "true")
        .env("VIGI_MINING_THREADS", config.threads.to_string())
        .env("VIGI_MINER_ADDRESS", &config.address)
        .env("VIGI_BOOTNODES", &config.bootnodes)
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().map_err(|e| format!("Unable to start VigiChain node: {e}"))?;
    let pid = child.id();
    *guard = Some(child);
    Ok(NodeStatus { running: true, pid: Some(pid), binary_available: true })
}

#[tauri::command]
fn stop_mining(process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(mut child) = guard.take() { child.kill().map_err(|e| format!("Unable to stop VigiChain node: {e}"))?; let _ = child.wait(); }
    Ok(NodeStatus { running: false, pid: None, binary_available: node_binary_path().is_ok() })
}

#[tauri::command]
fn miner_status(process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    let binary_available = node_binary_path().is_ok();
    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(child) = guard.as_mut() {
        match child.try_wait().map_err(|e| e.to_string())? {
            None => Ok(NodeStatus { running: true, pid: Some(child.id()), binary_available }),
            Some(_) => { *guard = None; Ok(NodeStatus { running: false, pid: None, binary_available }) }
        }
    } else { Ok(NodeStatus { running: false, pid: None, binary_available }) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MinerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![start_mining, stop_mining, miner_status, system_info, install_verified_node])
        .run(tauri::generate_context!())
        .expect("error while running Vigi Miner");
}
