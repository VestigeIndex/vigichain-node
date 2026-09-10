import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, Box, Cpu, Gauge, HardDrive, LockKeyhole, Network, Play,
  Settings2, ShieldCheck, Square, Zap, Shield, Download, SlidersHorizontal,
  Waves, CircleGauge, ServerCog, Sparkles
} from 'lucide-react';

type NetworkMode = 'testnet' | 'mainnet';
type PowerProfile = 'eco' | 'balanced' | 'performance' | 'custom';

type MinerConfig = {
  address: string;
  threads: number;
  bootnodes: string;
  network: NetworkMode;
  powerProfile: PowerProfile;
  cpuLimitPercent: number;
  sandboxed: boolean;
};

type NodeStatus = {
  running: boolean;
  pid?: number;
  binaryAvailable: boolean;
};

type SystemInfo = {
  logicalCpus: number;
  architecture: string;
  operatingSystem: string;
  nodeBinaryAvailable: boolean;
  nodeBinaryPath?: string;
};

type InstallResult = {
  tag: string;
  artifact: string;
  sha256: string;
  sourceCommit: string;
  builder: string;
  sbomComponents: number;
  installedPath: string;
  verified: boolean;
};

const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

const profileCpu: Record<PowerProfile, number> = {
  eco: 35,
  balanced: 65,
  performance: 90,
  custom: 70,
};

export default function App() {
  const [network, setNetwork] = useState<NetworkMode>('testnet');
  const [address, setAddress] = useState('');
  const [powerProfile, setPowerProfile] = useState<PowerProfile>('balanced');
  const [cpuLimitPercent, setCpuLimitPercent] = useState(65);
  const [threads, setThreads] = useState(1);
  const [maxThreads, setMaxThreads] = useState(Math.max(1, navigator.hardwareConcurrency || 1));
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number | undefined>();
  const [binaryAvailable, setBinaryAvailable] = useState(false);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [bootnodes, setBootnodes] = useState('seed-04.vigichain.org:28719');
  const sandboxed = true;

  const mainnetLocked = network === 'mainnet';

  useEffect(() => {
    let disposed = false;

    async function loadSystem() {
      try {
        const info = await invoke<SystemInfo>('system_info');
        if (disposed) return;
        setSystem(info);
        setBinaryAvailable(info.nodeBinaryAvailable);
        setMaxThreads(Math.max(1, info.logicalCpus));
        setThreads(Math.max(1, Math.ceil(info.logicalCpus * 0.65)));
      } catch (e) {
        if (!disposed) setError(String(e));
      }
    }

    async function pollStatus() {
      try {
        const status = await invoke<NodeStatus>('miner_status');
        if (disposed) return;
        setRunning(status.running);
        setPid(status.pid);
        setBinaryAvailable(status.binaryAvailable);
      } catch {
        // Preserve last known state on transient IPC failures.
      }
    }

    void loadSystem();
    void pollStatus();
    const timer = window.setInterval(() => void pollStatus(), 1500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const pct = powerProfile === 'custom' ? cpuLimitPercent : profileCpu[powerProfile];
    if (powerProfile !== 'custom') setCpuLimitPercent(pct);
    const logical = Math.max(1, maxThreads);
    setThreads(Math.max(1, Math.ceil(logical * pct / 100)));
  }, [powerProfile, cpuLimitPercent, maxThreads]);

  const addressValid = network === 'testnet'
    ? address.trim().startsWith('tvigi1')
    : address.trim().startsWith('vigi1');

  const canStart = useMemo(
    () => addressValid && binaryAvailable && !busy && !mainnetLocked,
    [addressValid, binaryAvailable, busy, mainnetLocked],
  );

  async function installNode() {
    setInstalling(true);
    setError('');
    try {
      const result = await invoke<InstallResult>('install_verified_node');
      setInstallResult(result);
      setBinaryAvailable(result.verified);
      const info = await invoke<SystemInfo>('system_info');
      setSystem(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  }

  async function startMining() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      const config: MinerConfig = {
        address: address.trim(),
        threads,
        bootnodes: bootnodes.trim(),
        network,
        powerProfile,
        cpuLimitPercent,
        sandboxed,
      };
      const result = await invoke<NodeStatus>('start_mining', { config });
      setRunning(result.running);
      setPid(result.pid);
      setBinaryAvailable(result.binaryAvailable);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopMining() {
    setBusy(true);
    setError('');
    try {
      const result = await invoke<NodeStatus>('stop_mining');
      setRunning(result.running);
      setPid(result.pid);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function changeNetwork(next: NetworkMode) {
    if (running) return;
    setNetwork(next);
    setAddress('');
    setError('');
  }

  const networkState = mainnetLocked
    ? 'LOCKED'
    : running
      ? 'MINING'
      : binaryAvailable
        ? 'READY'
        : 'NODE REQUIRED';

  return (
    <div className="mission-shell">
      <aside className="rail">
        <div className="brand-cluster">
          <div className="brand-core"><Zap size={18} /></div>
          <div><strong>Vigi Miner</strong><span>Mission Control</span></div>
        </div>

        <div className="rail-nav">
          <button className="rail-item active"><CircleGauge size={18} /><span>Control</span></button>
          <button className="rail-item"><Waves size={18} /><span>Telemetry</span></button>
          <button className="rail-item"><ServerCog size={18} /><span>Node</span></button>
          <button className="rail-item"><Shield size={18} /><span>Sandbox</span></button>
          <button className="rail-item"><Settings2 size={18} /><span>System</span></button>
        </div>

        <div className="rail-foot">
          <div className="privacy-chip"><ShieldCheck size={16} /><span>Sandbox enforced</span></div>
          <small>Minimal permissions · local data isolation</small>
        </div>
      </aside>

      <main className="mission-main">
        <header className="mission-header">
          <div>
            <p className="eyebrow">VIGICHAIN / MINING OPERATIONS</p>
            <h1>Local mining, isolated by design.</h1>
            <p className="lede">Control compute, node state and network access from one native surface. No shell required.</p>
          </div>
          <div className={`network-pill ${mainnetLocked ? 'locked' : running ? 'active' : ''}`}>
            <span className="pulse" /> {network.toUpperCase()} · {networkState}
          </div>
        </header>

        <section className="network-deck">
          <button className={network === 'testnet' ? 'network-tile selected' : 'network-tile'} onClick={() => changeNetwork('testnet')} disabled={running}>
            <div className="network-tile-top"><span className="network-dot live" /><strong>Testnet</strong></div>
            <small>Live environment</small>
            <em>MINING AVAILABLE</em>
          </button>
          <button className={network === 'mainnet' ? 'network-tile selected mainnet' : 'network-tile mainnet'} onClick={() => changeNetwork('mainnet')} disabled={running}>
            <div className="network-tile-top"><LockKeyhole size={14} /><strong>Mainnet</strong></div>
            <small>Launch path prepared</small>
            <em>LOCKED</em>
          </button>
        </section>

        <section className="command-grid">
          <div className="command-surface">
            <div className="command-visual">
              <div className={`core-ring ${running ? 'live' : ''}`}>
                <div className="core-ring-inner">
                  {mainnetLocked ? <LockKeyhole size={30} /> : running ? <Sparkles size={32} /> : <Cpu size={32} />}
                </div>
              </div>
              <div>
                <p className="eyebrow">EXECUTION STATE</p>
                <h2>{mainnetLocked ? 'Mainnet locked' : running ? 'Mining active' : binaryAvailable ? 'Ready for work' : 'Node not installed'}</h2>
                <span>{running && pid ? `Process ${pid} · sandboxed` : 'Local isolated execution domain'}</span>
              </div>
            </div>

            <div className="address-zone">
              <label>{network === 'testnet' ? 'Reward address · Testnet' : 'Reward address · Mainnet'}</label>
              <div className="address-input">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={network === 'testnet' ? 'tvigi1…' : 'vigi1…'}
                  spellCheck={false}
                  disabled={mainnetLocked}
                />
                <span>{address ? short(address) : 'No key material required'}</span>
              </div>
            </div>

            {!binaryAvailable && !mainnetLocked && (
              <button className="install-action" onClick={installNode} disabled={installing}>
                <Download size={18} />
                <div><strong>{installing ? 'Verifying release…' : 'Install verified node'}</strong><span>Signature + manifest + provenance + SBOM</span></div>
              </button>
            )}

            {installResult && (
              <div className="verified-strip">
                <ShieldCheck size={17} />
                <div><strong>{installResult.tag} verified</strong><span>{installResult.sourceCommit.slice(0, 12)} · {installResult.sbomComponents} SBOM components</span></div>
              </div>
            )}

            {!running ? (
              <button className="primary-action" disabled={!canStart} onClick={startMining}>
                {mainnetLocked ? <LockKeyhole size={18} /> : <Play size={18} fill="currentColor" />}
                {mainnetLocked ? 'Mainnet locked' : busy ? 'Starting isolated miner…' : 'Start mining'}
              </button>
            ) : (
              <button className="stop-action" disabled={busy} onClick={stopMining}><Square size={17} fill="currentColor" /> {busy ? 'Stopping…' : 'Stop mining'}</button>
            )}
          </div>

          <div className="telemetry-stack">
            <div className="telemetry-hero">
              <div className="telemetry-head"><span>Compute envelope</span><SlidersHorizontal size={17} /></div>
              <strong>{cpuLimitPercent}%</strong>
              <small>{threads} / {maxThreads} logical CPUs allocated</small>
              <div className="power-track"><span style={{ width: `${cpuLimitPercent}%` }} /></div>
            </div>

            <div className="telemetry-row">
              <Metric icon={<Gauge size={18} />} label="Hashrate" value={running ? '— H/s' : 'Idle'} />
              <Metric icon={<Network size={18} />} label="Peers" value="—" />
              <Metric icon={<Box size={18} />} label="Height" value="—" />
              <Metric icon={<HardDrive size={18} />} label="Storage" value="—" />
            </div>

            <div className="security-surface">
              <div className="security-icon"><ShieldCheck size={18} /></div>
              <div><strong>Privacy boundary active</strong><span>Node data lives in the Vigi sandbox. No wallet seeds, no arbitrary home-directory access.</span></div>
            </div>
          </div>
        </section>

        <section className="control-plane">
          <div className="control-plane-head">
            <div><p className="eyebrow">POWER MANAGEMENT</p><h2>Choose how much of this machine Vigi can use.</h2></div>
            <button className="ghost" onClick={() => setAdvanced(!advanced)}><Settings2 size={16} /> {advanced ? 'Hide advanced' : 'Advanced'}</button>
          </div>

          <div className="profile-grid">
            {(['eco', 'balanced', 'performance'] as PowerProfile[]).map((profile) => (
              <button key={profile} className={powerProfile === profile ? 'profile-card selected' : 'profile-card'} onClick={() => setPowerProfile(profile)} disabled={mainnetLocked}>
                <span>{profile === 'eco' ? '35%' : profile === 'balanced' ? '65%' : '90%'}</span>
                <strong>{profile[0].toUpperCase() + profile.slice(1)}</strong>
                <small>{profile === 'eco' ? 'Low impact, quiet system' : profile === 'balanced' ? 'Recommended for daily use' : 'Maximum sustained compute'}</small>
              </button>
            ))}
            <button className={powerProfile === 'custom' ? 'profile-card selected' : 'profile-card'} onClick={() => setPowerProfile('custom')} disabled={mainnetLocked}>
              <SlidersHorizontal size={18} />
              <strong>Custom</strong>
              <small>Exact CPU envelope</small>
            </button>
          </div>

          {powerProfile === 'custom' && (
            <div className="custom-power">
              <div><strong>CPU limit</strong><span>Hard ceiling applied by the Vigi sandbox controller.</span></div>
              <div className="slider-shell">
                <input type="range" min="10" max="100" step="5" value={cpuLimitPercent} onChange={(e) => setCpuLimitPercent(Number(e.target.value))} />
                <b>{cpuLimitPercent}%</b>
              </div>
            </div>
          )}

          {advanced && (
            <div className="advanced-grid">
              <div>
                <label>Bootnode</label>
                <input value={bootnodes} onChange={(e) => setBootnodes(e.target.value)} spellCheck={false} disabled={mainnetLocked} />
              </div>
              <div>
                <label>Execution model</label>
                <div className="readonly-box">Sandboxed subprocess · isolated data dir · deny-by-default</div>
              </div>
              {system?.nodeBinaryPath && <div className="span-two"><label>Verified node</label><div className="readonly-box mono">{system.nodeBinaryPath}</div></div>}
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
        </section>

        <footer><span>VigiChain · Testnet live · Mainnet locked</span><span>Vigi Miner 0.2 · Mission Control UX</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="telemetry-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div>;
}
