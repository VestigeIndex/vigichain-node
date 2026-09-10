use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:28720/v1/telemetry";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTelemetry { pub height: u64, pub target_height: u64, pub progress: f64 }

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pTelemetry { pub authenticated_peers: u32, pub inbound_peers: u32, pub outbound_peers: u32 }

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MiningTelemetry {
    pub enabled: bool, pub threads: u16, pub hashrate_hs: f64,
    pub blocks_found_session: u64, pub reward_address: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageTelemetry {
    pub chain_bytes: Option<u64>, pub state_bytes: Option<u64>,
    pub canonical_bytes: Option<u64>, pub compact_bytes: Option<u64>,
    pub ratio: Option<f64>, pub mode: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreTelemetry {
    pub schema_version: u32,
    pub network: String,
    pub node_version: String,
    pub uptime_seconds: u64,
    pub sync: SyncTelemetry,
    pub p2p: P2pTelemetry,
    pub mining: MiningTelemetry,
    pub storage: StorageTelemetry,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryState {
    pub available: bool,
    pub endpoint: String,
    pub snapshot: Option<CoreTelemetry>,
    pub reason: Option<String>,
}

fn local_endpoint() -> Result<String, String> {
    let endpoint = std::env::var("VIGI_TELEMETRY_URL").unwrap_or_else(|_| DEFAULT_ENDPOINT.into());
    let parsed = reqwest::Url::parse(&endpoint).map_err(|e| format!("Invalid telemetry URL: {e}"))?;
    if parsed.scheme() != "http" { return Err("Telemetry fallback must use local HTTP only".into()); }
    let host = parsed.host_str().unwrap_or("");
    if !matches!(host, "127.0.0.1" | "localhost" | "::1") {
        return Err("Vigi Miner refuses non-loopback telemetry endpoints".into());
    }
    Ok(endpoint)
}

pub fn snapshot() -> Result<TelemetryState, String> {
    let endpoint = local_endpoint()?;
    let client = Client::builder()
        .connect_timeout(Duration::from_millis(400))
        .timeout(Duration::from_millis(900))
        .build().map_err(|e| e.to_string())?;

    let response = match client.get(&endpoint).send() {
        Ok(response) => response,
        Err(e) => return Ok(TelemetryState { available: false, endpoint, snapshot: None, reason: Some(format!("Core telemetry unavailable: {e}")) }),
    };
    if !response.status().is_success() {
        return Ok(TelemetryState { available: false, endpoint, snapshot: None, reason: Some(format!("Core telemetry returned HTTP {}", response.status())) });
    }
    let snapshot: CoreTelemetry = response.json().map_err(|e| format!("Core telemetry schema is invalid: {e}"))?;
    if snapshot.schema_version != 1 { return Err(format!("Unsupported Core telemetry schema {}", snapshot.schema_version)); }
    if snapshot.network != "testnet" && snapshot.network != "mainnet" { return Err("Telemetry returned an unknown VigiChain network".into()); }
    if !(0.0..=1.0).contains(&snapshot.sync.progress) { return Err("Telemetry sync progress is outside 0..1".into()); }
    Ok(TelemetryState { available: true, endpoint, snapshot: Some(snapshot), reason: None })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_is_loopback() { assert!(DEFAULT_ENDPOINT.starts_with("http://127.0.0.1:")); }
}
