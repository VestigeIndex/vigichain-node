use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::State;

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

fn node_binary_path() -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("VIGI_NODE_BINARY") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Ok(path);
        }
        return Err("VIGI_NODE_BINARY points to a missing file".into());
    }

    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or("Unable to resolve user home directory")?;

    let base = PathBuf::from(home).join(".vigichain");
    let candidates = if cfg!(windows) {
        vec![
            base.join("vigichain-node-windows-x86_64.exe"),
            base.join("vigichain-node.exe"),
        ]
    } else {
        vec![
            base.join("vigichain-node-linux-x86_64"),
            base.join("vigichain-node"),
        ]
    };

    candidates.into_iter().find(|p| p.exists()).ok_or_else(|| {
        "Verified VigiChain node binary not found. Install a verified testnet release first or set VIGI_NODE_BINARY.".into()
    })
}

#[tauri::command]
fn system_info() -> SystemInfo {
    let logical_cpus = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let binary = node_binary_path().ok();

    SystemInfo {
        logical_cpus,
        architecture: std::env::consts::ARCH.to_string(),
        operating_system: std::env::consts::OS.to_string(),
        node_binary_available: binary.is_some(),
        node_binary_path: binary.map(|p| p.display().to_string()),
    }
}

#[tauri::command]
fn start_mining(config: MinerConfig, process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    match config.network.as_str() {
        "testnet" => {
            if !config.address.starts_with("tvigi1") {
                return Err("Testnet reward address must start with tvigi1".into());
            }
        }
        "mainnet" => {
            return Err("Mainnet is visible in Vigi Miner but remains locked while VigiChain Core keeps MAINNET_LAUNCHED=false".into());
        }
        _ => return Err("Unsupported VigiChain network".into()),
    }

    if config.threads == 0 {
        return Err("Mining threads must be greater than zero".into());
    }

    let available_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    if usize::from(config.threads) > available_threads {
        return Err(format!(
            "Requested {} mining threads but this system exposes only {} logical CPUs",
            config.threads, available_threads
        ));
    }

    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Ok(NodeStatus {
                running: true,
                pid: Some(child.id()),
                binary_available: true,
            });
        }
        *guard = None;
    }

    let binary = node_binary_path()?;
    let child = Command::new(binary)
        .env("VIGI_NETWORK", "testnet")
        .env("VIGI_ENABLE_MINING", "true")
        .env("VIGI_MINING_THREADS", config.threads.to_string())
        .env("VIGI_MINER_ADDRESS", &config.address)
        .env("VIGI_BOOTNODES", &config.bootnodes)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Unable to start VigiChain node: {e}"))?;

    let pid = child.id();
    *guard = Some(child);
    Ok(NodeStatus {
        running: true,
        pid: Some(pid),
        binary_available: true,
    })
}

#[tauri::command]
fn stop_mining(process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(mut child) = guard.take() {
        child
            .kill()
            .map_err(|e| format!("Unable to stop VigiChain node: {e}"))?;
        let _ = child.wait();
    }
    Ok(NodeStatus {
        running: false,
        pid: None,
        binary_available: node_binary_path().is_ok(),
    })
}

#[tauri::command]
fn miner_status(process: State<'_, MinerProcess>) -> Result<NodeStatus, String> {
    let binary_available = node_binary_path().is_ok();
    let mut guard = process.0.lock().map_err(|_| "Miner process lock poisoned")?;
    if let Some(child) = guard.as_mut() {
        match child.try_wait().map_err(|e| e.to_string())? {
            None => Ok(NodeStatus {
                running: true,
                pid: Some(child.id()),
                binary_available,
            }),
            Some(_) => {
                *guard = None;
                Ok(NodeStatus {
                    running: false,
                    pid: None,
                    binary_available,
                })
            }
        }
    } else {
        Ok(NodeStatus {
            running: false,
            pid: None,
            binary_available,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MinerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_mining,
            stop_mining,
            miner_status,
            system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vigi Miner");
}
