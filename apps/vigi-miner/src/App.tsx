import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Archive, Box, CheckCircle2, ChevronDown, CircleGauge, Cpu, Database,
  Download, Gauge, HardDrive, Languages, LifeBuoy, LockKeyhole, Microchip,
  Network, Play, RotateCcw, ScanSearch, ServerCog, Settings2, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Square, Waves, Zap,
} from 'lucide-react';
import { detectLocale, localeNames, supportedLocales, translator, type Locale } from './i18n';

type NetworkMode = 'testnet' | 'mainnet';
type PowerProfile = 'eco' | 'balanced' | 'performance' | 'custom';
type View = 'control' | 'storage' | 'help';
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

const profileCpu: Record<PowerProfile, number> = { eco: 35, balanced: 65, performance: 90, custom: 70 };
const compactModes: CompactMode[] = ['automatic', 'maximum', 'off'];
const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
const gb = (bytes: number) => `${(bytes / 1073741824).toFixed(bytes >= 1073741824 ? 2 : 3)} GB`;
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
        const status = await invoke<NodeStatus>('miner_status');
        if (!disposed) {
          setRunning(status.running);
          setPid(status.pid);
          setBinaryAvailable(status.binaryAvailable);
        }
      } catch { /* keep last known state */ }
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

  return (
    <div className="mission-shell">
      <Sidebar view={view} setView={setView} t={t} />
      <main className="mission-main">
        <div className="utility-bar">
          <div className="locale-select">
            <Languages size={14} />
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {supportedLocales.map((code) => <option key={code} value={code}>{localeNames[code]}</option>)}
            </select>
            <ChevronDown size={12} />
          </div>
        </div>

        {view === 'help' ? <HelpCenter t={t} /> : view === 'storage' ? (
          <StorageView t={t} mode={compactMode} stats={compactStats} advice={compactAdvice}
            result={compactResult} restore={restoreResult} busy={compacting}
            onMode={chooseCompact} onRun={runCompact} onRestore={restoreCompact} />
        ) : (
          <>
            <header className="mission-header">
              <div>
                <p className="eyebrow">{t('missionEyebrow')}</p>
                <h1>{t('title')}</h1>
                <p className="lede">{t('lede')}</p>
              </div>
              <div className={`network-pill ${mainnetLocked ? 'locked' : ''}`}><span className="pulse" />{network.toUpperCase()} · {networkState}</div>
            </header>

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
                <div className="telemetry-hero"><div className="telemetry-head"><span>{t('computeEnvelope')}</span><SlidersHorizontal /></div><strong>{cpuLimitPercent}%</strong><small>{threads} / {maxThreads} {t('logicalCpus')}</small><div className="power-track"><span style={{ width: `${cpuLimitPercent}%` }} /></div></div>
                <div className="telemetry-row"><Metric icon={<Gauge />} label="Hashrate" value={running ? '— H/s' : 'Idle'} /><Metric icon={<Network />} label="Peers" value="—" /><Metric icon={<Box />} label="Height" value="—" /><Metric icon={<HardDrive />} label="Compact" value={compactStats?.objects ? gb(compactStats.storedBytes) : 'Ready'} /></div>
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

function Sidebar({ view, setView, t }: { view: View; setView: (view: View) => void; t: (key: string) => string }) {
  return <aside className="rail"><div className="brand-cluster"><div className="brand-core"><Zap size={18} /></div><strong>Vigi Miner</strong><span>Mission Control</span></div><div className="rail-nav"><button className={`rail-item ${view === 'control' ? 'active' : ''}`} onClick={() => setView('control')}><CircleGauge /><span>{t('control')}</span></button><button className="rail-item"><Waves /><span>{t('telemetry')}</span></button><button className="rail-item"><ServerCog /><span>{t('node')}</span></button><button className={`rail-item ${view === 'storage' ? 'active' : ''}`} onClick={() => setView('storage')}><Archive /><span>{t('storage')}</span></button><button className="rail-item"><Shield /><span>{t('sandbox')}</span></button><button className={`rail-item ${view === 'help' ? 'active' : ''}`} onClick={() => setView('help')}><LifeBuoy /><span>{t('help')}</span></button></div><div className="rail-foot"><div className="privacy-chip"><ShieldCheck /><span>{t('sandboxEnforced')}</span></div></div></aside>;
}

function NetworkTile({ selected, disabled, title, subtitle, badge, live, onClick }: { selected: boolean; disabled: boolean; title: string; subtitle: string; badge: string; live?: boolean; onClick: () => void }) {
  return <button className={`network-tile ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onClick}><div className="network-tile-top">{live ? <span className="network-dot live" /> : <LockKeyhole size={14} />}<strong>{title}</strong></div><small>{subtitle}</small><em>{badge}</em></button>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="telemetry-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div>;
}

function HardwarePanel({ t, scanned, scanning, devices, onDetect }: { t: (key: string) => string; scanned: boolean; scanning: boolean; devices: MiningDevice[]; onDetect: () => void }) {
  return <section className="control-plane"><div className="control-plane-head"><div><p className="eyebrow">HARDWARE DISCOVERY</p><h2>{t('hardwareTitle')}</h2><p className="lede">{t('hardwareBody')}</p></div><button className="ghost" onClick={onDetect} disabled={scanning}><ScanSearch />{scanning ? t('scanning') : t('detectHardware')}</button></div>{!scanned ? <div className="permission-note"><ShieldCheck /><span>{t('permissionReadOnly')}</span></div> : devices.length === 0 ? <div className="empty-hardware"><Microchip /><span>{t('noHardware')}</span></div> : <div className="device-grid">{devices.map((device) => <div className="device-card" key={device.host}><Microchip /><strong>{device.identity}</strong><span>{device.host} · {device.protocol}</span><em>{device.compatibility}</em></div>)}</div>}</section>;
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
