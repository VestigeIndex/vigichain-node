import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, Archive, Box, CheckCircle2, ChevronDown, CircleGauge, Cpu, Database,
  Download, Gauge, HardDrive, Languages, LifeBuoy, LockKeyhole, Microchip,
  Network, Play, RotateCcw, ScanSearch, ServerCog, Settings2, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Square, Waves, Zap,
} from 'lucide-react';
import { detectLocale, localeNames, supportedLocales, translator, type Locale } from './i18n';

type NetworkMode = 'testnet' | 'mainnet';
type PowerProfile = 'eco' | 'balanced' | 'performance' | 'custom';
type View = 'control' | 'telemetry' | 'node' | 'storage' | 'sandbox' | 'help';
type CompactMode = 'automatic' | 'maximum' | 'off';

type MinerConfig = {
  address: string;
  threads: number;
  bootnodes: string;
  network: NetworkMode;
  powerProfile: PowerProfile;
  cpuLimitPercent: number;
  sandboxed: boolean;
};

type NodeStatus = { running: boolean; pid?: number; binaryAvailable: boolean };
type SystemInfo = {
  logicalCpus: number;
  architecture: string;
  operatingSystem: string;
  nodeBinaryAvailable: boolean;
  nodeBinaryPath?: string;
  containmentLevel: string;
  containmentDetail: string;
};
type InstallResult = { tag: string; sourceCommit: string; verified: boolean };
type MiningDevice = { host: string; protocol: string; identity: string; compatibility: string };
type CompactStats = {
  sourceBytes: number; storedBytes: number; savedBytes: number; objects: number;
  verifiedObjects: number; sourceCandidates: number; sourceDirectory: string;
};
type CompactRun = { objectsCompacted: number; savedBytes: number };
type RestoreRun = { objectsRestored: number; bytesRestored: number; restoreDirectory: string };
type CompactAdvice = {
  freeBytes: number; representedBytes: number; recommendedMode: CompactMode;
  pressure: 'normal' | 'elevated' | 'critical'; reason: string;
};
type CoreTelemetry = {
  schemaVersion: number;
  network: NetworkMode;
  nodeVersion: string;
  uptimeSeconds: number;
  sync: { height: number; targetHeight: number; progress: number };
  p2p: { authenticatedPeers: number; inboundPeers: number; outboundPeers: number };
  mining: { enabled: boolean; threads: number; hashrateHs: number; blocksFoundSession: number; rewardAddress: string };
  storage: {
    chainBytes?: number | null; stateBytes?: number | null; canonicalBytes?: number | null;
    compactBytes?: number | null; ratio?: number | null; mode?: string | null;
  };
};
type TelemetryState = { available: boolean; endpoint: string; snapshot?: CoreTelemetry | null; reason?: string | null };

type AppData = {
  network: NetworkMode;
  running: boolean;
  pid?: number;
  system: SystemInfo | null;
  telemetry: TelemetryState | null;
  trustedTelemetry: CoreTelemetry | null;
  telemetryState: string;
  telemetryNetworkMatch: boolean;
  compactStats: CompactStats | null;
};

const profileCpu: Record<PowerProfile, number> = { eco: 35, balanced: 65, performance: 90, custom: 70 };
const compactModes: CompactMode[] = ['automatic', 'maximum', 'off'];
const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
const gb = (bytes: number) => `${(bytes / 1073741824).toFixed(bytes >= 1073741824 ? 2 : 3)} GB`;
const formatHashrate = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  let n = Math.max(0, value); let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i += 1; }
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)} ${units[i]}`;
};
const duration = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
const savedCompactMode = (): CompactMode => {
  const mode = localStorage.getItem('vigi-compact-mode') as CompactMode | null;
  return mode && compactModes.includes(mode) ? mode : 'automatic';
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());
  const [view, setView] = useState<View>('control');
  const [network, setNetwork] = useState<NetworkMode>('testnet');
  const [address, setAddress] = useState('');
  const [powerProfile, setPowerProfile] = useState<PowerProfile>('balanced');
  const [cpuLimitPercent, setCpuLimitPercent] = useState(65);
  const [threads, setThreads] = useState(1);
  const [maxThreads, setMaxThreads] = useState(Math.max(1, navigator.hardwareConcurrency || 1));
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState<number>();
  const [binaryAvailable, setBinaryAvailable] = useState(false);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryState | null>(null);
  const [telemetrySeenAt, setTelemetrySeenAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [bootnodes, setBootnodes] = useState('seed-04.vigichain.org:28719');
  const [scanningHardware, setScanningHardware] = useState(false);
  const [hardwareScanned, setHardwareScanned] = useState(false);
  const [devices, setDevices] = useState<MiningDevice[]>([]);
  const [compactMode, setCompactMode] = useState<CompactMode>(savedCompactMode);
  const [compactStats, setCompactStats] = useState<CompactStats | null>(null);
  const [compactAdvice, setCompactAdvice] = useState<CompactAdvice | null>(null);
  const [compacting, setCompacting] = useState(false);
  const [compactResult, setCompactResult] = useState<CompactRun | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreRun | null>(null);

  const t = translator(locale);
  const mainnetLocked = network === 'mainnet';
  const telemetrySnapshot = telemetry?.available ? telemetry.snapshot ?? null : null;
  const telemetryNetworkMatch = !telemetrySnapshot || telemetrySnapshot.network === network;
  const trustedTelemetry = telemetryNetworkMatch ? telemetrySnapshot : null;
  const telemetryAge = telemetrySeenAt ? Math.max(0, Date.now() - telemetrySeenAt) : null;
  const telemetryState = !telemetryNetworkMatch ? 'NETWORK MISMATCH'
    : trustedTelemetry ? (telemetryAge != null && telemetryAge > 5000 ? 'STALE' : 'LIVE')
      : 'UNAVAILABLE';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('vigi-miner-locale', locale);
  }, [locale]);

  async function refreshCompact(mode = compactMode) {
    const [stats, advice] = await Promise.all([
      invoke<CompactStats>('compact_stats', { mode }),
      invoke<CompactAdvice>('compact_advice'),
    ]);
    setCompactStats(stats);
    setCompactAdvice(advice);
    return stats;
  }

  useEffect(() => {
    let disposed = false;
    async function init() {
      try {
        const info = await invoke<SystemInfo>('system_info');
        if (disposed) return;
        setSystem(info);
        setBinaryAvailable(info.nodeBinaryAvailable);
        setMaxThreads(Math.max(1, info.logicalCpus));
        setThreads(Math.max(1, Math.ceil(info.logicalCpus * 0.65)));
        await refreshCompact();
      } catch (e) { if (!disposed) setError(String(e)); }
    }
    async function poll() {
      try {
        const [status, live] = await Promise.all([
          invoke<NodeStatus>('miner_status'),
          invoke<TelemetryState>('telemetry_snapshot').catch(() => null),
        ]);
        if (disposed) return;
        setRunning(status.running);
        setPid(status.pid);
        setBinaryAvailable(status.binaryAvailable);
        if (live) {
          setTelemetry(live);
          if (live.available && live.snapshot) setTelemetrySeenAt(Date.now());
        }
      } catch { /* preserve the last known state */ }
    }
    void init();
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const pct = powerProfile === 'custom' ? cpuLimitPercent : profileCpu[powerProfile];
    if (powerProfile !== 'custom') setCpuLimitPercent(pct);
    setThreads(Math.max(1, Math.ceil(maxThreads * pct / 100)));
  }, [powerProfile, cpuLimitPercent, maxThreads]);

  const addressValid = network === 'testnet'
    ? address.trim().startsWith('tvigi1')
    : address.trim().startsWith('vigi1');
  const canStart = useMemo(
    () => addressValid && binaryAvailable && !busy && !mainnetLocked,
    [addressValid, binaryAvailable, busy, mainnetLocked],
  );

  async function installNode() {
    setInstalling(true); setError('');
    try {
      const result = await invoke<InstallResult>('install_verified_node');
      setInstallResult(result);
      setBinaryAvailable(result.verified);
      setSystem(await invoke<SystemInfo>('system_info'));
    } catch (e) { setError(String(e)); }
    finally { setInstalling(false); }
  }

  async function detectHardware() {
    setScanningHardware(true); setError('');
    try {
      setDevices(await invoke<MiningDevice[]>('discover_mining_hardware', { permission: true }));
      setHardwareScanned(true);
    } catch (e) { setError(String(e)); setHardwareScanned(true); }
    finally { setScanningHardware(false); }
  }

  async function startMining() {
    if (!canStart) return;
    setBusy(true); setError('');
    try {
      const config: MinerConfig = {
        address: address.trim(), threads, bootnodes: bootnodes.trim(), network,
        powerProfile, cpuLimitPercent, sandboxed: true,
      };
      const result = await invoke<NodeStatus>('start_mining', { config });
      setRunning(result.running); setPid(result.pid);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function stopMining() {
    setBusy(true); setError('');
    try {
      const result = await invoke<NodeStatus>('stop_mining');
      setRunning(result.running); setPid(result.pid);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function runCompact() {
    if (compactMode === 'off') return;
    setCompacting(true); setError(''); setRestoreResult(null);
    try {
      setCompactResult(await invoke<CompactRun>('compact_now', { mode: compactMode }));
      await refreshCompact();
    } catch (e) { setError(String(e)); }
    finally { setCompacting(false); }
  }

  async function restoreCompact() {
    setCompacting(true); setError('');
    try {
      setRestoreResult(await invoke<RestoreRun>('compact_restore_all'));
      await refreshCompact();
    } catch (e) { setError(String(e)); }
    finally { setCompacting(false); }
  }

  function chooseCompact(mode: CompactMode) {
    setCompactMode(mode);
    localStorage.setItem('vigi-compact-mode', mode);
    setError('');
    void refreshCompact(mode).catch((e) => setError(String(e)));
  }

  const networkState = mainnetLocked ? t('locked') : running ? 'MINING' : binaryAvailable ? 'READY' : 'NODE REQUIRED';
  const appData: AppData = { network, running, pid, system, telemetry, trustedTelemetry, telemetryState, telemetryNetworkMatch, compactStats };

  return (
    <div className="mission-shell">
      <Sidebar view={view} setView={setView} t={t} />
      <main className="mission-main">
        <TopBar locale={locale} setLocale={setLocale} telemetryState={telemetryState} />

        {view === 'help' && <HelpCenter t={t} />}
        {view === 'telemetry' && <TelemetryView data={appData} />}
        {view === 'node' && <NodeView data={appData} binaryAvailable={binaryAvailable} />}
        {view === 'sandbox' && <SandboxView system={system} cpuLimitPercent={cpuLimitPercent} />}
        {view === 'storage' && <StorageView t={t} mode={compactMode} stats={compactStats} advice={compactAdvice} result={compactResult} restore={restoreResult} busy={compacting} onMode={chooseCompact} onRun={runCompact} onRestore={restoreCompact} />}
        {view === 'control' && (
          <>
            <header className="mission-header">
              <div><p className="eyebrow">{t('missionEyebrow')}</p><h1>{t('title')}</h1><p className="lede">{t('lede')}</p></div>
              <div className={`network-pill ${mainnetLocked ? 'locked' : ''}`}><span className="pulse" />{network.toUpperCase()} · {networkState}</div>
            </header>

            {!telemetryNetworkMatch && <div className="telemetry-warning">Core telemetry reports {telemetrySnapshot?.network?.toUpperCase()} while Mission Control is set to {network.toUpperCase()}. Metrics are intentionally hidden.</div>}

            <section className="network-deck">
              <NetworkTile selected={network === 'testnet'} disabled={running} title={t('testnet')} subtitle={t('liveEnvironment')} badge={t('miningAvailable')} live onClick={() => { setNetwork('testnet'); setAddress(''); }} />
              <NetworkTile selected={network === 'mainnet'} disabled={running} title={t('mainnet')} subtitle={t('launchPrepared')} badge={t('locked')} onClick={() => { setNetwork('mainnet'); setAddress(''); }} />
            </section>

            <section className="command-grid">
              <div className="command-surface">
                <div className="command-visual">
                  <div className={`core-ring ${running ? 'live' : ''}`}><div className="core-ring-inner">{mainnetLocked ? <LockKeyhole /> : running ? <Sparkles /> : <Cpu />}</div></div>
                  <div><p className="eyebrow">{t('executionState')}</p><h2>{mainnetLocked ? t('mainnetLocked') : running ? t('miningActive') : binaryAvailable ? t('ready') : t('nodeNotInstalled')}</h2><span>{running && pid ? `Process ${pid} · ${system?.containmentLevel ?? 'isolated'}` : t('localIsolation')}</span></div>
                </div>
                <div className="address-zone"><label>{t('rewardAddress')}</label><div className="address-input"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={network === 'testnet' ? 'tvigi1…' : 'vigi1…'} disabled={mainnetLocked} spellCheck={false} /><span>{address ? short(address) : t('noKeyMaterial')}</span></div></div>
                {!binaryAvailable && !mainnetLocked && <button className="install-action" onClick={installNode} disabled={installing}><Download size={18} /><div><strong>{installing ? t('verifyingRelease') : t('installVerifiedNode')}</strong><span>Signature + manifest + provenance + SBOM</span></div></button>}
                {installResult && <div className="verified-strip"><ShieldCheck size={17} /><div><strong>{installResult.tag} verified</strong><span>{installResult.sourceCommit.slice(0, 12)}</span></div></div>}
                {!running ? <button className="primary-action" disabled={!canStart} onClick={startMining}>{mainnetLocked ? <LockKeyhole /> : <Play />}{mainnetLocked ? t('mainnetLocked') : t('startMining')}</button> : <button className="stop-action" onClick={stopMining}><Square />{t('stopMining')}</button>}
              </div>

              <div className="telemetry-stack">
                <div className="telemetry-hero"><div className="telemetry-head"><span>{t('computeEnvelope')}</span><SlidersHorizontal /></div><strong>{cpuLimitPercent}%</strong><small>{threads} / {maxThreads} {t('logicalCpus')} · OS constrained</small><div className="power-track"><span style={{ width: `${cpuLimitPercent}%` }} /></div></div>
                <LiveMetrics telemetry={trustedTelemetry} running={running} compactStats={compactStats} />
                {trustedTelemetry && <SyncSurface telemetry={trustedTelemetry} />}
                <div className="security-surface"><ShieldCheck /><div><strong>{system?.containmentLevel ?? t('privacyBoundary')}</strong><span>{system?.containmentDetail ?? t('privacyBody')}</span></div></div>
              </div>
            </section>

            <section className="control-plane">
              <div className="control-plane-head"><div><p className="eyebrow">{t('powerManagement')}</p><h2>{t('powerTitle')}</h2></div><button className="ghost" onClick={() => setAdvanced(!advanced)}><Settings2 />{t('advanced')}</button></div>
              <div className="profile-grid">{(['eco', 'balanced', 'performance', 'custom'] as PowerProfile[]).map((profile) => <button key={profile} className={powerProfile === profile ? 'profile-card selected' : 'profile-card'} onClick={() => setPowerProfile(profile)}><span>{profile === 'eco' ? '35%' : profile === 'balanced' ? '65%' : profile === 'performance' ? '90%' : '↔'}</span><strong>{t(profile)}</strong><small>{t(`${profile}Body`)}</small></button>)}</div>
              {powerProfile === 'custom' && <div className="custom-power"><div><strong>{t('cpuLimit')}</strong></div><div className="slider-shell"><input type="range" min="10" max="100" step="5" value={cpuLimitPercent} onChange={(e) => setCpuLimitPercent(Number(e.target.value))} /><b>{cpuLimitPercent}%</b></div></div>}
              {advanced && <div className="advanced-grid"><div><label>Bootnode</label><input value={bootnodes} onChange={(e) => setBootnodes(e.target.value)} /></div>{system?.nodeBinaryPath && <div><label>Verified node</label><div className="readonly-box mono">{system.nodeBinaryPath}</div></div>}</div>}
            </section>

            <HardwarePanel t={t} scanned={hardwareScanned} scanning={scanningHardware} devices={devices} onDetect={detectHardware} />
          </>
        )}

        {error && <div className="error-box">{error}</div>}
        <footer><span>VigiChain · Testnet live · Mainnet locked</span><span>Vigi Miner 0.3 · Mission Control</span></footer>
      </main>
    </div>
  );
}

function TopBar({ locale, setLocale, telemetryState }: { locale: Locale; setLocale: (locale: Locale) => void; telemetryState: string }) {
  const cssState = telemetryState.toLowerCase().replaceAll(' ', '-');
  return <div className="utility-bar"><div className={`telemetry-badge ${cssState}`}><span className="telemetry-led" />CORE TELEMETRY · {telemetryState}</div><div className="locale-select"><Languages size={14} /><select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>{supportedLocales.map((code) => <option key={code} value={code}>{localeNames[code]}</option>)}</select><ChevronDown size={12} /></div></div>;
}

function Sidebar({ view, setView, t }: { view: View; setView: (view: View) => void; t: (key: string) => string }) {
  const nav: Array<[View, ReactNode, string]> = [
    ['control', <CircleGauge key="control" />, t('control')],
    ['telemetry', <Waves key="telemetry" />, t('telemetry')],
    ['node', <ServerCog key="node" />, t('node')],
    ['storage', <Archive key="storage" />, t('storage')],
    ['sandbox', <Shield key="sandbox" />, t('sandbox')],
    ['help', <LifeBuoy key="help" />, t('help')],
  ];
  return <aside className="rail"><div className="brand-cluster"><div className="brand-core"><Zap size={18} /></div><strong>Vigi Miner</strong><span>Mission Control</span></div><div className="rail-nav">{nav.map(([id, icon, label]) => <button key={id} className={`rail-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>{icon}<span>{label}</span></button>)}</div><div className="rail-foot"><div className="privacy-chip"><ShieldCheck /><span>{t('sandboxEnforced')}</span></div></div></aside>;
}

function NetworkTile({ selected, disabled, title, subtitle, badge, live, onClick }: { selected: boolean; disabled: boolean; title: string; subtitle: string; badge: string; live?: boolean; onClick: () => void }) {
  return <button className={`network-tile ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onClick}><div className="network-tile-top">{live ? <span className="network-dot live" /> : <LockKeyhole size={14} />}<strong>{title}</strong></div><small>{subtitle}</small><em>{badge}</em></button>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="telemetry-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div>;
}

function LiveMetrics({ telemetry, running, compactStats }: { telemetry: CoreTelemetry | null; running: boolean; compactStats: CompactStats | null }) {
  const storage = telemetry?.storage.compactBytes ?? compactStats?.storedBytes ?? null;
  return <div className="telemetry-row"><Metric icon={<Gauge />} label="Hashrate" value={telemetry ? formatHashrate(telemetry.mining.hashrateHs) : running ? '—' : 'Idle'} /><Metric icon={<Network />} label="Peers" value={telemetry ? String(telemetry.p2p.authenticatedPeers) : '—'} /><Metric icon={<Box />} label="Height" value={telemetry ? telemetry.sync.height.toLocaleString() : '—'} /><Metric icon={<HardDrive />} label="Storage" value={storage != null ? gb(storage) : '—'} /></div>;
}

function SyncSurface({ telemetry }: { telemetry: CoreTelemetry }) {
  const progress = Math.min(100, Math.max(0, telemetry.sync.progress * 100));
  return <div className="sync-surface"><div><span>SYNC</span><strong>{progress.toFixed(2)}%</strong></div><div className="sync-track"><span style={{ width: `${progress}%` }} /></div><small>{telemetry.nodeVersion} · uptime {duration(telemetry.uptimeSeconds)} · {telemetry.mining.blocksFoundSession} blocks this session</small></div>;
}

function HardwarePanel({ t, scanned, scanning, devices, onDetect }: { t: (key: string) => string; scanned: boolean; scanning: boolean; devices: MiningDevice[]; onDetect: () => void }) {
  return <section className="control-plane"><div className="control-plane-head"><div><p className="eyebrow">HARDWARE DISCOVERY</p><h2>{t('hardwareTitle')}</h2><p className="lede">{t('hardwareBody')}</p></div><button className="ghost" onClick={onDetect} disabled={scanning}><ScanSearch />{scanning ? t('scanning') : t('detectHardware')}</button></div>{!scanned ? <div className="permission-note"><ShieldCheck /><span>{t('permissionReadOnly')}</span></div> : devices.length === 0 ? <div className="empty-hardware"><Microchip /><span>{t('noHardware')}</span></div> : <div className="device-grid">{devices.map((device) => <div className="device-card" key={device.host}><Microchip /><strong>{device.identity}</strong><span>{device.host} · {device.protocol}</span><em>{device.compatibility}</em></div>)}</div>}</section>;
}

function TelemetryView({ data }: { data: AppData }) {
  const live = data.trustedTelemetry;
  return <><header className="mission-header"><div><p className="eyebrow">VIGICHAIN / OBSERVABILITY</p><h1>Telemetry without guesswork.</h1><p className="lede">Read-only Core signals are accepted only from the local telemetry contract. Missing data remains unknown instead of being fabricated.</p></div><div className={`network-pill ${data.telemetryState !== 'LIVE' ? 'locked' : ''}`}><Activity size={14} />{data.telemetryState}</div></header>
    {!data.telemetryNetworkMatch && <div className="telemetry-warning">The Core is reporting a different network. Mission Control refuses to mix metrics across networks.</div>}
    <section className="telemetry-matrix"><Metric icon={<Gauge />} label="Hashrate" value={live ? formatHashrate(live.mining.hashrateHs) : '—'} /><Metric icon={<Network />} label="Authenticated peers" value={live ? String(live.p2p.authenticatedPeers) : '—'} /><Metric icon={<Box />} label="Current height" value={live ? live.sync.height.toLocaleString() : '—'} /><Metric icon={<Archive />} label="Blocks found" value={live ? String(live.mining.blocksFoundSession) : '—'} /><Metric icon={<Waves />} label="Inbound peers" value={live ? String(live.p2p.inboundPeers) : '—'} /><Metric icon={<Waves />} label="Outbound peers" value={live ? String(live.p2p.outboundPeers) : '—'} /><Metric icon={<Cpu />} label="Mining threads" value={live ? String(live.mining.threads) : '—'} /><Metric icon={<HardDrive />} label="Canonical storage" value={live?.storage.canonicalBytes != null ? gb(live.storage.canonicalBytes) : '—'} /></section>
    <section className="control-plane telemetry-detail"><div className="control-plane-head"><div><p className="eyebrow">CORE CONTRACT</p><h2>{live ? `${live.nodeVersion} · schema v${live.schemaVersion}` : 'Core telemetry unavailable'}</h2></div><span className="readonly-chip">{data.telemetry?.endpoint ?? 'loopback only'}</span></div>{live ? <><SyncSurface telemetry={live} /><div className="detail-grid"><Detail label="Network" value={live.network.toUpperCase()} /><Detail label="Uptime" value={duration(live.uptimeSeconds)} /><Detail label="Reward address" value={short(live.mining.rewardAddress)} /><Detail label="Mining" value={live.mining.enabled ? 'ENABLED' : 'DISABLED'} /></div></> : <div className="empty-hardware"><Activity /><span>{data.telemetry?.reason ?? 'Waiting for the private Core telemetry producer.'}</span></div>}</section></>;
}

function NodeView({ data, binaryAvailable }: { data: AppData; binaryAvailable: boolean }) {
  const live = data.trustedTelemetry;
  return <><header className="mission-header"><div><p className="eyebrow">VIGICHAIN / NODE</p><h1>The daemon remains authoritative.</h1><p className="lede">Vigi Miner supervises the signed node process. Consensus stays inside VigiChain Core.</p></div><div className={`network-pill ${data.running ? '' : 'locked'}`}><ServerCog size={14} />{data.running ? 'RUNNING' : binaryAvailable ? 'READY' : 'NOT INSTALLED'}</div></header>
    <section className="node-grid"><div className="node-core-card"><div className={`core-ring ${data.running ? 'live' : ''}`}><div className="core-ring-inner"><ServerCog /></div></div><div><span>PROCESS</span><strong>{data.running ? `PID ${data.pid ?? '—'}` : 'Stopped'}</strong><small>{data.system?.containmentLevel ?? 'containment unknown'}</small></div></div><DetailCard label="Network" value={live?.network.toUpperCase() ?? data.network.toUpperCase()} sub="Mainnet launch gate remains Core-owned" /><DetailCard label="Node version" value={live?.nodeVersion ?? 'Awaiting telemetry'} sub={data.system?.architecture ?? 'unknown architecture'} /><DetailCard label="Binary" value={binaryAvailable ? 'VERIFIED PATH READY' : 'MISSING'} sub={data.system?.nodeBinaryPath ?? 'Install a signed VigiChain release'} /></section>
    <section className="control-plane"><p className="eyebrow">LOCAL BINARY</p><h2>Execution boundary</h2><div className="detail-grid"><Detail label="Operating system" value={data.system?.operatingSystem ?? '—'} /><Detail label="Architecture" value={data.system?.architecture ?? '—'} /><Detail label="Logical CPUs" value={String(data.system?.logicalCpus ?? '—')} /><Detail label="Containment" value={data.system?.containmentLevel ?? '—'} /></div>{data.system?.nodeBinaryPath && <div className="compact-path"><span>Verified node path</span><code>{data.system.nodeBinaryPath}</code></div>}</section></>;
}

function SandboxView({ system, cpuLimitPercent }: { system: SystemInfo | null; cpuLimitPercent: number }) {
  const windows = system?.operatingSystem === 'windows';
  return <><header className="mission-header"><div><p className="eyebrow">VIGI MINER / SECURITY BOUNDARY</p><h1>Isolation is a measurable capability.</h1><p className="lede">Mission Control reports what the operating system actually enforces. It does not label a private directory as a full sandbox.</p></div><div className="network-pill"><ShieldCheck size={14} />{system?.containmentLevel?.toUpperCase() ?? 'CHECKING'}</div></header>
    <section className="security-grid"><SecurityStep state="ENFORCED" title="Private Vigi directories" body="Node data and temporary files are kept inside the Vigi execution root." /><SecurityStep state="ENFORCED" title="Cleared parent environment" body="The node does not inherit arbitrary application/session secrets." /><SecurityStep state="ENFORCED" title={windows ? 'Windows Job Object' : 'No-new-privileges'} body={windows ? `The process tree is contained and receives a ${cpuLimitPercent}% hard CPU-rate cap.` : 'Privilege escalation through exec is disabled and core dumps are blocked.'} /><SecurityStep state="NEXT HARDENING" title={windows ? 'AppContainer filesystem/network policy' : 'Namespace + seccomp filesystem/network policy'} body="This stronger confinement is deliberately not claimed as active yet." /></section>
    <section className="control-plane"><p className="eyebrow">CURRENT CAPABILITY</p><h2>{system?.containmentLevel ?? 'Detecting…'}</h2><p className="lede">{system?.containmentDetail ?? 'Reading local containment capability.'}</p></section></>;
}

function SecurityStep({ state, title, body }: { state: string; title: string; body: string }) {
  return <article className={`security-step ${state === 'ENFORCED' ? 'enforced' : 'future'}`}><span>{state}</span><ShieldCheck /><h2>{title}</h2><p>{body}</p></article>;
}

function DetailCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <article className="detail-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function StorageView({ t, mode, stats, advice, result, restore, busy, onMode, onRun, onRestore }: { t: (key: string) => string; mode: CompactMode; stats: CompactStats | null; advice: CompactAdvice | null; result: CompactRun | null; restore: RestoreRun | null; busy: boolean; onMode: (mode: CompactMode) => void; onRun: () => void; onRestore: () => void }) {
  const hasObjects = !!stats?.objects;
  const ratio = hasObjects && stats!.sourceBytes ? Math.max(0, 100 - stats!.storedBytes / stats!.sourceBytes * 100) : null;
  return <><header className="mission-header"><div><p className="eyebrow">VIGI COMPACT / STORAGE ENGINE</p><h1>{t('compactTitle')}</h1><p className="lede">{t('compactIntro')}</p></div><div className="network-pill"><CheckCircle2 />LOSSLESS · VERIFIED</div></header>
    {advice && <section className={`storage-advisor ${advice.pressure}`}><div><span>STORAGE ADVISOR · {advice.pressure.toUpperCase()}</span><strong>{gb(advice.freeBytes)} free · {advice.recommendedMode.toUpperCase()} recommended</strong><p>{advice.reason}</p></div>{mode !== advice.recommendedMode && <button className="ghost" onClick={() => onMode(advice.recommendedMode)}>Apply recommendation</button>}</section>}
    <section className="compact-hero"><div className="compact-orbit"><Database /><strong>{ratio === null ? 'READY' : `${ratio.toFixed(1)}%`}</strong><span>{t('spaceReduction')}</span></div><div className="compact-numbers"><div><span>{t('canonicalData')}</span><strong>{stats ? gb(stats.sourceBytes) : '—'}</strong></div><div><span>{t('compactStored')}</span><strong>{hasObjects ? gb(stats!.storedBytes) : '—'}</strong></div><div><span>{t('spaceSaved')}</span><strong>{hasObjects ? gb(stats!.savedBytes) : '—'}</strong></div><div><span>{t('verifiedObjects')}</span><strong>{stats ? `${stats.verifiedObjects}/${stats.objects}` : '—'}</strong></div></div></section>
    <section className="control-plane"><div className="control-plane-head"><div><p className="eyebrow">COMPRESSION POLICY</p><h2>{t('compactMode')}</h2></div><div className="action-row"><button className="ghost" disabled={busy || !hasObjects} onClick={onRestore}><RotateCcw />{t('restoreVerified')}</button><button className="primary-inline" disabled={busy || mode === 'off'} onClick={onRun}><Archive />{busy ? t('compacting') : t('compactNow')}</button></div></div><div className="profile-grid compact-modes">{compactModes.map((item) => <button key={item} className={mode === item ? 'profile-card selected' : 'profile-card'} onClick={() => onMode(item)}><strong>{t(`compact_${item}`)}</strong><small>{t(`compact_${item}_body`)}</small></button>)}</div><div className="compact-integrity"><ShieldCheck /><div><strong>{t('compactIntegrity')}</strong><span>{t('compactIntegrityBody')}</span></div></div>{stats && <div className="compact-path"><span>{stats.sourceCandidates} {t('candidates')}</span><code>{stats.sourceDirectory}</code></div>}{result && <div className="verified-strip"><CheckCircle2 /><div><strong>{result.objectsCompacted} objects round-trip verified</strong><span>{gb(result.savedBytes)} saved</span></div></div>}{restore && <div className="verified-strip"><RotateCcw /><div><strong>{restore.objectsRestored} canonical objects restored + verified</strong><span>{gb(restore.bytesRestored)} · {restore.restoreDirectory}</span></div></div>}</section></>;
}

function HelpCenter({ t }: { t: (key: string) => string }) {
  const questions = [['helpInstallQ', 'helpInstallA'], ['helpSandboxQ', 'helpSandboxA'], ['helpPowerQ', 'helpPowerA'], ['helpAsicQ', 'helpAsicA'], ['helpCompactQ', 'helpCompactA'], ['helpMainnetQ', 'helpMainnetA']];
  return <><header className="mission-header"><div><p className="eyebrow">VIGI MINER / SUPPORT</p><h1>{t('helpCenter')}</h1><p className="lede">{t('helpIntro')}</p></div></header><section className="help-grid">{questions.map(([question, answer]) => <article className="help-card" key={question}><LifeBuoy /><div><h2>{t(question)}</h2><p>{t(answer)}</p></div></article>)}</section></>;
}
