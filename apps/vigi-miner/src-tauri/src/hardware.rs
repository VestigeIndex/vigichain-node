use serde::Serialize;
use std::{
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, Shutdown, SocketAddr, TcpStream},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MiningDevice {
    pub host: String,
    pub device_type: String,
    pub protocol: String,
    pub identity: String,
    pub compatibility: String,
    pub permission_scope: String,
}

fn probe_cgminer(ip: Ipv4Addr) -> Option<MiningDevice> {
    let addr = SocketAddr::new(IpAddr::V4(ip), 4028);
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(120)).ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(200)));
    stream.write_all(br#"{"command":"version"}"#).ok()?;
    let _ = stream.shutdown(Shutdown::Write);

    let mut response = Vec::with_capacity(2048);
    stream.take(8192).read_to_end(&mut response).ok()?;
    if response.is_empty() {
        return None;
    }
    let text = String::from_utf8_lossy(&response);
    let recognizable = text.contains("STATUS")
        || text.contains("CGMiner")
        || text.contains("cgminer")
        || text.contains("BMMiner")
        || text.contains("bosminer")
        || text.contains("VERSION");
    if !recognizable {
        return None;
    }

    let identity = text
        .chars()
        .filter(|c| !c.is_control())
        .take(180)
        .collect::<String>();

    Some(MiningDevice {
        host: ip.to_string(),
        device_type: "asic-or-external-miner".into(),
        protocol: "cgminer-rpc-readonly".into(),
        identity,
        compatibility: "detected-unverified".into(),
        permission_scope: "read-only-discovery".into(),
    })
}

#[tauri::command]
pub fn discover_mining_hardware(permission: bool) -> Result<Vec<MiningDevice>, String> {
    if !permission {
        return Err("Hardware discovery requires explicit user permission".into());
    }

    let local = local_ip_address::local_ip()
        .map_err(|e| format!("Unable to determine local network address: {e}"))?;
    let local = match local {
        IpAddr::V4(v4) if v4.is_private() => v4,
        _ => return Err("ASIC LAN discovery is limited to a private IPv4 network".into()),
    };

    // Deliberately limited to the local /24. Vigi Miner never performs a broad network scan.
    let octets = local.octets();
    let results = Arc::new(Mutex::new(Vec::<MiningDevice>::new()));
    let mut workers = Vec::new();

    for lane in 0u8..16 {
        let results = Arc::clone(&results);
        workers.push(thread::spawn(move || {
            let mut host = lane.saturating_add(1);
            while host < 255 {
                let ip = Ipv4Addr::new(octets[0], octets[1], octets[2], host);
                if ip != local {
                    if let Some(device) = probe_cgminer(ip) {
                        if let Ok(mut guard) = results.lock() {
                            guard.push(device);
                        }
                    }
                }
                match host.checked_add(16) {
                    Some(next) => host = next,
                    None => break,
                }
            }
        }));
    }

    for worker in workers {
        let _ = worker.join();
    }

    let mut devices = results
        .lock()
        .map_err(|_| "Hardware discovery result lock poisoned")?
        .clone();
    devices.sort_by(|a, b| a.host.cmp(&b.host));
    Ok(devices)
}
