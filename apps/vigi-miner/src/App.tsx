import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Box, Cpu, Gauge, HardDrive, LockKeyhole, Network, Play,
  Settings2, ShieldCheck, Square, Zap, Shield, Download, SlidersHorizontal,
  Waves, CircleGauge, ServerCog, Sparkles, ScanSearch, Microchip, LifeBuoy, Languages, ChevronDown
} from 'lucide-react';
import { detectLocale, localeNames, supportedLocales, translator, type Locale } from './i18n';

type NetworkMode = 'testnet' | 'mainnet';
type PowerProfile = 'eco' | 'balanced' | 'performance' | 'custom';
type View = 'control' | 'help';

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
type SystemInfo = { logicalCpus: number; architecture: string; operatingSystem: string; nodeBinaryAvailable: boolean; nodeBinaryPath?: string };
type InstallResult = { tag: string; artifact: string; sha256: string; sourceCommit: string; builder: string; sbomComponents: number; installedPath: string; verified: boolean };
type MiningDevice = { host: string; deviceType: string; protocol: string; identity: string; compatibility: string; permissionScope: string };

const short = (value: string) => value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
const profileCpu: Record<PowerProfile, number> = { eco: 35, balanced: 65, performance: 90, custom: 70 };

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
  const [pid, setPid] = useState<number | undefined>();
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
  const sandboxed = true;
  const t = translator(locale);
  const mainnetLocked = network === 'mainnet';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('vigi-miner-locale', locale);
  }, [locale]);

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
      } catch (e) { if (!disposed) setError(String(e)); }
    }
    async function pollStatus() {
      try {
        const status = await invoke<NodeStatus>('miner_status');
        if (disposed) return;
        setRunning(status.running); setPid(status.pid); setBinaryAvailable(status.binaryAvailable);
      } catch { /* preserve last known state */ }
    }
    void loadSystem(); void pollStatus();
    const timer = window.setInterval(() => void pollStatus(), 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const pct = powerProfile === 'custom' ? cpuLimitPercent : profileCpu[powerProfile];
    if (powerProfile !== 'custom') setCpuLimitPercent(pct);
    setThreads(Math.max(1, Math.ceil(Math.max(1, maxThreads) * pct / 100)));
  }, [powerProfile, cpuLimitPercent, maxThreads]);

  const addressValid = network === 'testnet' ? address.trim().startsWith('tvigi1') : address.trim().startsWith('vigi1');
  const canStart = useMemo(() => addressValid && binaryAvailable && !busy && !mainnetLocked, [addressValid, binaryAvailable, busy, mainnetLocked]);

  async function installNode() {
    setInstalling(true); setError('');
    try {
      const result = await invoke<InstallResult>('install_verified_node');
      setInstallResult(result); setBinaryAvailable(result.verified);
      setSystem(await invoke<SystemInfo>('system_info'));
    } catch (e) { setError(String(e)); } finally { setInstalling(false); }
  }

  async function detectHardware() {
    setScanningHardware(true); setHardwareScanned(false); setError('');
    try {
      const found = await invoke<MiningDevice[]>('discover_mining_hardware', { permission: true });
      setDevices(found); setHardwareScanned(true);
    } catch (e) { setError(String(e)); setHardwareScanned(true); } finally { setScanningHardware(false); }
  }

  async function startMining() {
    if (!canStart) return;
    setBusy(true); setError('');
    try {
      const config: MinerConfig = { address: address.trim(), threads, bootnodes: bootnodes.trim(), network, powerProfile, cpuLimitPercent, sandboxed };
      const result = await invoke<NodeStatus>('start_mining', { config });
      setRunning(result.running); setPid(result.pid); setBinaryAvailable(result.binaryAvailable);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  async function stopMining() {
    setBusy(true); setError('');
    try {
      const result = await invoke<NodeStatus>('stop_mining');
      setRunning(result.running); setPid(result.pid);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }

  function changeNetwork(next: NetworkMode) {
    if (running) return;
    setNetwork(next); setAddress(''); setError('');
  }

  const networkState = mainnetLocked ? t('locked') : running ? 'MINING' : binaryAvailable ? 'READY' : 'NODE REQUIRED';

  return (
    <div className="mission-shell">
      <aside className="rail">
        <div className="brand-cluster">
          <div className="brand-core"><Zap size={18} /></div>
          <div><strong>Vigi Miner</strong><span>Mission Control</span></div>
        </div>
        <div className="rail-nav">
          <button className={`rail-item ${view === 'control' ? 'active' : ''}`} onClick={() => setView('control')}><CircleGauge size={18} /><span>{t('control')}</span></button>
          <button className="rail-item"><Waves size={18} /><span>{t('telemetry')}</span></button>
          <button className="rail-item"><ServerCog size={18} /><span>{t('node')}</span></button>
          <button className="rail-item"><Shield size={18} /><span>{t('sandbox')}</span></button>
          <button className="rail-item"><Settings2 size={18} /><span>{t('system')}</span></button>
          <button className={`rail-item ${view === 'help' ? 'active' : ''}`} onClick={() => setView('help')}><LifeBuoy size={18} /><span>{t('help')}</span></button>
        </div>
        <div className="rail-foot">
          <div className="privacy-chip"><ShieldCheck size={16} /><span>{t('sandboxEnforced')}</span></div>
          <small>{t('minimalEnvironment')}</small>
        </div>
      </aside>

      <main className="mission-main">
        <div className="utility-bar">
          <div className="locale-select"><Languages size={14} /><span>{t('language')}</span><select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>{supportedLocales.map((code) => <option key={code} value={code}>{localeNames[code]}</option>)}</select><ChevronDown size={12} /></div>
        </div>

        {view === 'help' ? <HelpCenter t={t} /> : (
          <>
            <header className="mission-header">
              <div><p className="eyebrow">{t('missionEyebrow')}</p><h1>{t('title')}</h1><p className="lede">{t('lede')}</p></div>
              <div className={`network-pill ${mainnetLocked ? 'locked' : running ? 'active' : ''}`}><span className="pulse" /> {network.toUpperCase()} · {networkState}</div>
            </header>

            <section className="network-deck">
              <button className={network === 'testnet' ? 'network-tile selected' : 'network-tile'} onClick={() => changeNetwork('testnet')} disabled={running}><div className="network-tile-top"><span className="network-dot live" /><strong>{t('testnet')}</strong></div><small>{t('liveEnvironment')}</small><em>{t('miningAvailable')}</em></button>
              <button className={network === 'mainnet' ? 'network-tile selected mainnet' : 'network-tile mainnet'} onClick={() => changeNetwork('mainnet')} disabled={running}><div className="network-tile-top"><LockKeyhole size={14} /><strong>{t('mainnet')}</strong></div><small>{t('launchPrepared')}</small><em>{t('locked')}</em></button>
            </section>

            <section className="command-grid">
              <div className="command-surface">
                <div className="command-visual"><div className={`core-ring ${running ? 'live' : ''}`}><div className="core-ring-inner">{mainnetLocked ? <LockKeyhole size={30} /> : running ? <Sparkles size={32} /> : <Cpu size={32} />}</div></div><div><p className="eyebrow">{t('executionState')}</p><h2>{mainnetLocked ? t('mainnetLocked') : running ? t('miningActive') : binaryAvailable ? t('ready') : t('nodeNotInstalled')}</h2><span>{running && pid ? `Process ${pid} · sandboxed` : t('localIsolation')}</span></div></div>
                <div className="address-zone"><label>{t('rewardAddress')} · {network === 'testnet' ? t('testnet') : t('mainnet')}</label><div className="address-input"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={network === 'testnet' ? 'tvigi1…' : 'vigi1…'} spellCheck={false} disabled={mainnetLocked} /><span>{address ? short(address) : t('noKeyMaterial')}</span></div></div>
                {!binaryAvailable && !mainnetLocked && <button className="install-action" onClick={installNode} disabled={installing}><Download size={18} /><div><strong>{installing ? t('verifyingRelease') : t('installVerifiedNode')}</strong><span>Signature + manifest + provenance + SBOM</span></div></button>}
                {installResult && <div className="verified-strip"><ShieldCheck size={17} /><div><strong>{installResult.tag} verified</strong><span>{installResult.sourceCommit.slice(0,12)} · {installResult.sbomComponents} SBOM components</span></div></div>}
                {!running ? <button className="primary-action" disabled={!canStart} onClick={startMining}>{mainnetLocked ? <LockKeyhole size={18} /> : <Play size={18} fill="currentColor" />}{mainnetLocked ? t('mainnetLocked') : busy ? t('startingMiner') : t('startMining')}</button> : <button className="stop-action" disabled={busy} onClick={stopMining}><Square size={17} fill="currentColor" /> {busy ? t('stopping') : t('stopMining')}</button>}
              </div>

              <div className="telemetry-stack">
                <div className="telemetry-hero"><div className="telemetry-head"><span>{t('computeEnvelope')}</span><SlidersHorizontal size={17} /></div><strong>{cpuLimitPercent}%</strong><small>{threads} / {maxThreads} {t('logicalCpus')}</small><div className="power-track"><span style={{width:`${cpuLimitPercent}%`}} /></div></div>
                <div className="telemetry-row"><Metric icon={<Gauge size={18}/>} label="Hashrate" value={running ? '— H/s' : 'Idle'} /><Metric icon={<Network size={18}/>} label="Peers" value="—" /><Metric icon={<Box size={18}/>} label="Height" value="—" /><Metric icon={<HardDrive size={18}/>} label="Storage" value="—" /></div>
                <div className="security-surface"><div className="security-icon"><ShieldCheck size={18}/></div><div><strong>{t('privacyBoundary')}</strong><span>{t('privacyBody')}</span></div></div>
              </div>
            </section>

            <section className="control-plane">
              <div className="control-plane-head"><div><p className="eyebrow">{t('powerManagement')}</p><h2>{t('powerTitle')}</h2></div><button className="ghost" onClick={() => setAdvanced(!advanced)}><Settings2 size={16}/> {advanced ? t('hideAdvanced') : t('advanced')}</button></div>
              <div className="profile-grid">{(['eco','balanced','performance'] as PowerProfile[]).map((profile) => <button key={profile} className={powerProfile===profile?'profile-card selected':'profile-card'} onClick={() => setPowerProfile(profile)} disabled={mainnetLocked}><span>{profile==='eco'?'35%':profile==='balanced'?'65%':'90%'}</span><strong>{t(profile)}</strong><small>{t(`${profile}Body`)}</small></button>)}<button className={powerProfile==='custom'?'profile-card selected':'profile-card'} onClick={() => setPowerProfile('custom')} disabled={mainnetLocked}><SlidersHorizontal size={18}/><strong>{t('custom')}</strong><small>{t('customBody')}</small></button></div>
              {powerProfile==='custom' && <div className="custom-power"><div><strong>{t('cpuLimit')}</strong><span>{t('customBody')}</span></div><div className="slider-shell"><input type="range" min="10" max="100" step="5" value={cpuLimitPercent} onChange={(e) => setCpuLimitPercent(Number(e.target.value))}/><b>{cpuLimitPercent}%</b></div></div>}
              {advanced && <div className="advanced-grid"><div><label>Bootnode</label><input value={bootnodes} onChange={(e) => setBootnodes(e.target.value)} spellCheck={false} disabled={mainnetLocked}/></div><div><label>Execution model</label><div className="readonly-box">Isolated subprocess · isolated data dir · cleared environment</div></div>{system?.nodeBinaryPath && <div className="span-two"><label>Verified node</label><div className="readonly-box mono">{system.nodeBinaryPath}</div></div>}</div>}
            </section>

            <section className="control-plane hardware-plane">
              <div className="control-plane-head"><div><p className="eyebrow">HARDWARE DISCOVERY</p><h2>{t('hardwareTitle')}</h2><p className="lede compact">{t('hardwareBody')}</p></div><button className="ghost hardware-scan" onClick={detectHardware} disabled={scanningHardware}><ScanSearch size={16}/> {scanningHardware ? t('scanning') : t('detectHardware')}</button></div>
              {!hardwareScanned && <div className="permission-note"><ShieldCheck size={16}/><span>{t('permissionReadOnly')}</span></div>}
              {hardwareScanned && devices.length===0 && <div className="empty-hardware"><Microchip size={22}/><span>{t('noHardware')}</span></div>}
              {devices.length>0 && <div className="device-grid">{devices.map((device) => <div className="device-card" key={`${device.host}-${device.protocol}`}><div><Microchip size={18}/><span>{device.host}</span></div><strong>{device.identity || device.deviceType}</strong><small>{device.protocol}</small><em>{t('detectedUnverified')}</em></div>)}</div>}
            </section>

            {error && <div className="error-box">{error}</div>}
            <footer><span>VigiChain · Testnet live · Mainnet locked</span><span>Vigi Miner 0.2 · Mission Control UX</span></footer>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) { return <div className="telemetry-card"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div>; }

function HelpCenter({t}:{t:(key:string)=>string}) {
  const items = [
    ['helpInstallQ','helpInstallA'], ['helpSandboxQ','helpSandboxA'], ['helpPowerQ','helpPowerA'], ['helpAsicQ','helpAsicA'], ['helpMainnetQ','helpMainnetA']
  ];
  return <section className="help-center"><div className="help-hero"><div className="security-icon"><LifeBuoy size={20}/></div><div><p className="eyebrow">VIGI MINER / SUPPORT</p><h1>{t('helpCenter')}</h1><p className="lede">{t('helpIntro')}</p></div></div><div className="help-grid">{items.map(([q,a]) => <details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>)}</div></section>;
}
