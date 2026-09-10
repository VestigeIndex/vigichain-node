import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Box, Cpu, Gauge, HardDrive, LockKeyhole, Network, Play, Settings2, ShieldCheck, Square, Zap } from 'lucide-react';

type NetworkMode = 'testnet' | 'mainnet';

type MinerConfig = {
  address: string;
  threads: number;
  bootnodes: string;
  network: NetworkMode;
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

const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

export default function App() {
  const [network, setNetwork] = useState<NetworkMode>('testnet');
  const [address, setAddress] = useState('');
  const [threads, setThreads] = useState(1);
  const [maxThreads, setMaxThreads] = useState(Math.max(1, navigator.hardwareConcurrency || 1));
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number | undefined>();
  const [binaryAvailable, setBinaryAvailable] = useState(false);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [bootnodes, setBootnodes] = useState('seed-04.vigichain.org:28719');

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
        setThreads(Math.max(1, Math.min(info.logicalCpus, Math.ceil(info.logicalCpus * 0.75))));
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
        // Keep last known state if local IPC has a transient failure.
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

  const addressValid = network === 'testnet' ? address.trim().startsWith('tvigi1') : address.trim().startsWith('vigi1');
  const canStart = useMemo(
    () => addressValid && binaryAvailable && !busy && !mainnetLocked,
    [addressValid, binaryAvailable, busy, mainnetLocked],
  );

  async function startMining() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      const config: MinerConfig = { address: address.trim(), threads, bootnodes: bootnodes.trim(), network };
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={19} /></div>
          <div><strong>Vigi Miner</strong><span>VigiChain Mining Client</span></div>
        </div>

        <nav>
          <button className="nav-item active"><Gauge size={18} /> Overview</button>
          <button className="nav-item"><Box size={18} /> Node</button>
          <button className="nav-item"><Activity size={18} /> Performance</button>
          <button className="nav-item"><Settings2 size={18} /> Settings</button>
        </nav>

        <div className="security-card">
          <ShieldCheck size={20} />
          <div><strong>Network safety enforced</strong><span>Mainnet cannot execute until Core unlocks it</span></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">MINING CONTROL CENTER</p>
            <h1>Mine VigiChain without the terminal.</h1>
          </div>
          <div className={`network-pill ${mainnetLocked ? 'locked' : running ? 'active' : ''}`}>
            <span className="pulse" /> {network.toUpperCase()} · {networkState}
          </div>
        </header>

        <section className="network-switcher" aria-label="VigiChain network">
          <button className={network === 'testnet' ? 'network-option selected' : 'network-option'} onClick={() => changeNetwork('testnet')} disabled={running}>
            <span className="network-dot live" />
            <span><strong>Testnet</strong><small>Live · mining available</small></span>
          </button>
          <button className={network === 'mainnet' ? 'network-option selected mainnet' : 'network-option mainnet'} onClick={() => changeNetwork('mainnet')} disabled={running}>
            <LockKeyhole size={15} />
            <span><strong>Mainnet</strong><small>Locked until launch</small></span>
            <em>COMING SOON</em>
          </button>
        </section>

        <section className="hero-grid">
          <div className="panel primary-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{network.toUpperCase()} MINER</p>
                <h2>{mainnetLocked ? 'Mainnet is locked' : running ? 'Mining is active' : binaryAvailable ? 'Ready to mine' : 'Install the verified node'}</h2>
              </div>
              <div className={`status-orb ${running ? 'running' : ''} ${mainnetLocked ? 'locked' : ''}`}>
                {mainnetLocked ? <LockKeyhole size={25} /> : <Cpu size={28} />}
              </div>
            </div>

            {mainnetLocked && (
              <div className="mainnet-lock-banner">
                <LockKeyhole size={18} />
                <div><strong>Mainnet interface is ready.</strong><span>Mining remains disabled while VigiChain Core reports MAINNET_LAUNCHED=false.</span></div>
              </div>
            )}

            <label>{network === 'testnet' ? 'Testnet reward address' : 'Mainnet reward address'}</label>
            <div className="input-shell">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={network === 'testnet' ? 'tvigi1…' : 'vigi1…'} spellCheck={false} disabled={mainnetLocked} />
              {address && <span>{short(address)}</span>}
            </div>
            <p className="hint">The miner only needs a reward address. No seed phrase or private key is stored.</p>

            {!binaryAvailable && !mainnetLocked && (
              <div className="error-box">No verified VigiChain node binary was found in ~/.vigichain. Automatic verified installation is being integrated into this client.</div>
            )}

            {!running ? (
              <button className="primary-action" disabled={!canStart} onClick={startMining}>
                {mainnetLocked ? <LockKeyhole size={18} /> : <Play size={19} fill="currentColor" />}
                {mainnetLocked ? 'Mainnet locked' : busy ? 'Starting…' : 'Start mining'}
              </button>
            ) : (
              <button className="stop-action" disabled={busy} onClick={stopMining}><Square size={17} fill="currentColor" /> {busy ? 'Stopping…' : 'Stop mining'}</button>
            )}

            {running && pid && <p className="hint">Node process PID {pid} · monitored locally every 1.5 seconds</p>}
            {error && <div className="error-box">{error}</div>}
          </div>

          <div className="metrics-grid">
            <Metric icon={<Gauge size={20} />} label="Hashrate" value={running ? '— H/s' : 'Idle'} detail="Awaiting Core telemetry contract" />
            <Metric icon={<Network size={20} />} label="Peers" value="—" detail="Authenticated P2P" />
            <Metric icon={<Box size={20} />} label="Height" value="—" detail="Current chain tip" />
            <Metric icon={<HardDrive size={20} />} label="Storage" value="— GB" detail="Vigi Compact integration target" />
          </div>
        </section>

        <section className="panel configuration-panel">
          <div className="panel-header compact">
            <div><p className="eyebrow">COMPUTE</p><h2>Mining profile</h2></div>
            <button className="ghost" onClick={() => setAdvanced(!advanced)}><Settings2 size={16} /> {advanced ? 'Simple mode' : 'Advanced'}</button>
          </div>

          <div className="setting-row">
            <div>
              <strong>CPU threads</strong>
              <span>{system ? `${system.operatingSystem} · ${system.architecture} · ${system.logicalCpus} logical CPUs detected` : 'Detecting local hardware…'}</span>
            </div>
            <div className="thread-control">
              <input type="range" min="1" max={maxThreads} value={threads} onChange={(e) => setThreads(Number(e.target.value))} disabled={mainnetLocked} />
              <b>{threads}</b>
            </div>
          </div>

          {advanced && (
            <div className="advanced-block">
              <label>Bootnode</label>
              <input value={bootnodes} onChange={(e) => setBootnodes(e.target.value)} spellCheck={false} disabled={mainnetLocked} />
              {system?.nodeBinaryPath && <p className="hint">Node binary: {system.nodeBinaryPath}</p>}
              <p className="hint">Network selection is passed to the node controller, but the backend refuses Mainnet until the Core launch gate is explicitly opened.</p>
            </div>
          )}
        </section>

        <footer><span>VigiChain · Testnet live · Mainnet locked</span><span>Desktop alpha 0.1.0</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="panel metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
