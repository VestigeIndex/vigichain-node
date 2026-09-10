import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Box, Cpu, Gauge, HardDrive, Network, Play, Settings2, ShieldCheck, Square, Zap } from 'lucide-react';

type MinerConfig = {
  address: string;
  threads: number;
  bootnodes: string;
};

type NodeStatus = {
  running: boolean;
  pid?: number;
};

const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

export default function App() {
  const [address, setAddress] = useState('');
  const [threads, setThreads] = useState(Math.max(1, navigator.hardwareConcurrency || 1));
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [bootnodes, setBootnodes] = useState('seed-04.vigichain.org:28719');

  const canStart = useMemo(() => address.trim().startsWith('tvigi1') && !busy, [address, busy]);

  async function startMining() {
    if (!canStart) return;
    setBusy(true);
    setError('');
    try {
      const config: MinerConfig = { address: address.trim(), threads, bootnodes: bootnodes.trim() };
      const result = await invoke<NodeStatus>('start_mining', { config });
      setRunning(result.running);
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
      await invoke('stop_mining');
      setRunning(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={19} /></div>
          <div><strong>Vigi Miner</strong><span>VigiChain Testnet</span></div>
        </div>

        <nav>
          <button className="nav-item active"><Gauge size={18} /> Overview</button>
          <button className="nav-item"><Box size={18} /> Node</button>
          <button className="nav-item"><Activity size={18} /> Performance</button>
          <button className="nav-item"><Settings2 size={18} /> Settings</button>
        </nav>

        <div className="security-card">
          <ShieldCheck size={20} />
          <div><strong>Testnet protected</strong><span>Mainnet remains locked</span></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">MINING CONTROL CENTER</p>
            <h1>Mine VigiChain without the terminal.</h1>
          </div>
          <div className="network-pill"><span className="pulse" /> TESTNET · ONLINE</div>
        </header>

        <section className="hero-grid">
          <div className="panel primary-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">MINER</p>
                <h2>{running ? 'Mining is active' : 'Ready to mine'}</h2>
              </div>
              <div className={`status-orb ${running ? 'running' : ''}`}><Cpu size={28} /></div>
            </div>

            <label>Reward address</label>
            <div className="input-shell">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="tvigi1…" spellCheck={false} />
              {address && <span>{short(address)}</span>}
            </div>
            <p className="hint">The miner only needs a reward address. No seed phrase or private key is stored.</p>

            {!running ? (
              <button className="primary-action" disabled={!canStart} onClick={startMining}><Play size={19} fill="currentColor" /> {busy ? 'Starting…' : 'Start mining'}</button>
            ) : (
              <button className="stop-action" disabled={busy} onClick={stopMining}><Square size={17} fill="currentColor" /> {busy ? 'Stopping…' : 'Stop mining'}</button>
            )}

            {error && <div className="error-box">{error}</div>}
          </div>

          <div className="metrics-grid">
            <Metric icon={<Gauge size={20} />} label="Hashrate" value={running ? '— H/s' : 'Idle'} detail="Live metric pending Core telemetry" />
            <Metric icon={<Network size={20} />} label="Peers" value="—" detail="Authenticated P2P" />
            <Metric icon={<Box size={20} />} label="Height" value="—" detail="Current chain tip" />
            <Metric icon={<HardDrive size={20} />} label="Storage" value="— GB" detail="Vigi Compact ready" />
          </div>
        </section>

        <section className="panel configuration-panel">
          <div className="panel-header compact">
            <div><p className="eyebrow">COMPUTE</p><h2>Mining profile</h2></div>
            <button className="ghost" onClick={() => setAdvanced(!advanced)}><Settings2 size={16} /> {advanced ? 'Simple mode' : 'Advanced'}</button>
          </div>

          <div className="setting-row">
            <div><strong>CPU threads</strong><span>Use fewer threads to keep the computer responsive.</span></div>
            <div className="thread-control">
              <input type="range" min="1" max={Math.max(1, navigator.hardwareConcurrency || 1)} value={threads} onChange={(e) => setThreads(Number(e.target.value))} />
              <b>{threads}</b>
            </div>
          </div>

          {advanced && (
            <div className="advanced-block">
              <label>Bootnode</label>
              <input value={bootnodes} onChange={(e) => setBootnodes(e.target.value)} spellCheck={false} />
              <p className="hint">Advanced settings map to VigiChain node environment variables rather than modifying consensus logic.</p>
            </div>
          )}
        </section>

        <footer><span>VigiChain · Public Testnet</span><span>Desktop alpha 0.1.0</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="panel metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
