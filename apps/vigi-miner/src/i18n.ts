export const supportedLocales = ['en', 'es', 'de', 'fr', 'pt', 'ar', 'zh'] as const;
export type Locale = typeof supportedLocales[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
  ar: 'العربية',
  zh: '中文',
};

type Dictionary = Record<string, string>;

const en: Dictionary = {
  control: 'Control', telemetry: 'Telemetry', node: 'Node', sandbox: 'Sandbox', system: 'System', help: 'Help',
  missionEyebrow: 'VIGICHAIN / MINING OPERATIONS', title: 'Local mining, isolated by design.',
  lede: 'Control compute, node state, external miners and network access from one native surface. No shell required.',
  testnet: 'Testnet', mainnet: 'Mainnet', liveEnvironment: 'Live environment', miningAvailable: 'MINING AVAILABLE', launchPrepared: 'Launch path prepared', locked: 'LOCKED',
  executionState: 'EXECUTION STATE', ready: 'Ready for work', miningActive: 'Mining active', nodeNotInstalled: 'Node not installed', mainnetLocked: 'Mainnet locked',
  localIsolation: 'Local isolated execution domain', rewardAddress: 'Reward address', noKeyMaterial: 'No key material required',
  installVerifiedNode: 'Install verified node', verifyingRelease: 'Verifying release…', startMining: 'Start mining', startingMiner: 'Starting isolated miner…', stopMining: 'Stop mining', stopping: 'Stopping…',
  computeEnvelope: 'Compute envelope', logicalCpus: 'logical CPUs allocated', privacyBoundary: 'Privacy boundary active', privacyBody: 'Node data lives in the Vigi sandbox. No wallet seeds and no arbitrary home-directory access.',
  powerManagement: 'POWER MANAGEMENT', powerTitle: 'Choose how much of this machine Vigi can use.', advanced: 'Advanced', hideAdvanced: 'Hide advanced',
  eco: 'Eco', balanced: 'Balanced', performance: 'Performance', custom: 'Custom', ecoBody: 'Low impact, quiet system', balancedBody: 'Recommended for daily use', performanceBody: 'Maximum sustained compute', customBody: 'Exact CPU envelope', cpuLimit: 'CPU limit',
  hardwareTitle: 'External mining hardware', hardwareBody: 'ASIC and external miner discovery is off by default. Vigi scans only after you grant permission.', detectHardware: 'Detect mining hardware', scanning: 'Scanning local network…', noHardware: 'No compatible mining API detected.', detectedUnverified: 'Detected · compatibility not yet verified',
  permissionReadOnly: 'Read-only discovery',
  helpCenter: 'Help Center', helpIntro: 'Guidance for mining, privacy, hardware, releases and network safety.',
  helpInstallQ: 'How do I start?', helpInstallA: 'Install the verified node, enter a reward address, choose a power profile and press Start mining.',
  helpSandboxQ: 'What does the sandbox protect?', helpSandboxA: 'Vigi Miner isolates chain data and temp files, clears the inherited environment and only passes the variables required by the node.',
  helpPowerQ: 'What does the power limit do?', helpPowerA: 'It controls the CPU envelope used by Vigi Miner. Eco, Balanced and Performance provide presets; Custom gives you an explicit ceiling.',
  helpAsicQ: 'Can I use an ASIC?', helpAsicA: 'You can grant permission to detect supported miner APIs on your private LAN. Detection does not imply VigiChain PoW compatibility; the app reports that separately.',
  helpMainnetQ: 'Why is Mainnet visible but locked?', helpMainnetA: 'The interface is ready for Mainnet, but the backend refuses to execute it until the VigiChain Core launch gate is explicitly opened.',
  language: 'Language', sandboxEnforced: 'Isolation enforced', minimalEnvironment: 'Minimal environment · isolated Vigi data',
};

const es: Dictionary = {
  control:'Control', telemetry:'Telemetría', node:'Nodo', sandbox:'Sandbox', system:'Sistema', help:'Ayuda', missionEyebrow:'VIGICHAIN / OPERACIONES DE MINERÍA', title:'Minería local, aislada por diseño.', lede:'Controla cómputo, nodo, mineros externos y acceso de red desde una única superficie nativa. Sin Shell.', testnet:'Testnet', mainnet:'Mainnet', liveEnvironment:'Entorno activo', miningAvailable:'MINERÍA DISPONIBLE', launchPrepared:'Preparada para lanzamiento', locked:'BLOQUEADA', executionState:'ESTADO DE EJECUCIÓN', ready:'Lista para trabajar', miningActive:'Minería activa', nodeNotInstalled:'Nodo no instalado', mainnetLocked:'Mainnet bloqueada', localIsolation:'Entorno de ejecución local aislado', rewardAddress:'Dirección de recompensa', noKeyMaterial:'No requiere claves privadas', installVerifiedNode:'Instalar nodo verificado', verifyingRelease:'Verificando release…', startMining:'Iniciar minería', startingMiner:'Iniciando minero aislado…', stopMining:'Detener minería', stopping:'Deteniendo…', computeEnvelope:'Potencia asignada', logicalCpus:'CPU lógicas asignadas', privacyBoundary:'Límite de privacidad activo', privacyBody:'Los datos del nodo viven en el sandbox de Vigi. Sin seeds de wallet ni acceso arbitrario al directorio personal.', powerManagement:'GESTIÓN DE POTENCIA', powerTitle:'Elige cuánta potencia de este equipo puede usar Vigi.', advanced:'Avanzado', hideAdvanced:'Ocultar avanzado', eco:'Eco', balanced:'Equilibrado', performance:'Rendimiento', custom:'Personalizado', ecoBody:'Bajo impacto y poco ruido', balancedBody:'Recomendado para uso diario', performanceBody:'Máximo cómputo sostenido', customBody:'Límite exacto de CPU', cpuLimit:'Límite de CPU', hardwareTitle:'Hardware de minería externo', hardwareBody:'La detección de ASIC y mineros externos está desactivada por defecto. Vigi solo escanea cuando das permiso.', detectHardware:'Detectar hardware de minería', scanning:'Escaneando red local…', noHardware:'No se detectó una API de minería compatible.', detectedUnverified:'Detectado · compatibilidad aún no verificada', permissionReadOnly:'Descubrimiento de solo lectura', helpCenter:'Centro de ayuda', helpIntro:'Guía para minería, privacidad, hardware, releases y seguridad de red.', helpInstallQ:'¿Cómo empiezo?', helpInstallA:'Instala el nodo verificado, introduce una dirección de recompensa, elige un perfil de potencia y pulsa Iniciar minería.', helpSandboxQ:'¿Qué protege el sandbox?', helpSandboxA:'Vigi Miner aísla los datos de cadena y temporales, limpia el entorno heredado y solo pasa al nodo las variables necesarias.', helpPowerQ:'¿Qué hace el límite de potencia?', helpPowerA:'Controla la potencia de CPU usada por Vigi Miner. Eco, Equilibrado y Rendimiento son perfiles; Personalizado permite fijar un techo.', helpAsicQ:'¿Puedo usar un ASIC?', helpAsicA:'Puedes conceder permiso para detectar APIs de mineros compatibles en tu LAN privada. Detectar un ASIC no implica que sea compatible con el PoW de VigiChain; la app lo indica por separado.', helpMainnetQ:'¿Por qué aparece Mainnet si está bloqueada?', helpMainnetA:'La interfaz está preparada, pero el backend no la ejecutará hasta que se abra explícitamente la puerta de lanzamiento del Core.', language:'Idioma', sandboxEnforced:'Aislamiento obligatorio', minimalEnvironment:'Entorno mínimo · datos Vigi aislados',
};

const de: Dictionary = { ...en, control:'Steuerung', telemetry:'Telemetrie', node:'Knoten', system:'System', help:'Hilfe', title:'Lokales Mining, von Grund auf isoliert.', lede:'Rechenleistung, Node-Status, externe Miner und Netzwerkzugriff in einer nativen Oberfläche steuern. Keine Shell nötig.', testnet:'Testnet', mainnet:'Mainnet', mainnetLocked:'Mainnet gesperrt', startMining:'Mining starten', stopMining:'Mining stoppen', powerTitle:'Wähle, wie viel Leistung Vigi von diesem Rechner nutzen darf.', hardwareTitle:'Externe Mining-Hardware', detectHardware:'Mining-Hardware erkennen', helpCenter:'Hilfezentrum', language:'Sprache' };
const fr: Dictionary = { ...en, control:'Contrôle', telemetry:'Télémétrie', node:'Nœud', system:'Système', help:'Aide', title:'Minage local, isolé par conception.', lede:'Contrôlez le calcul, le nœud, les mineurs externes et le réseau depuis une interface native. Aucun shell requis.', mainnetLocked:'Mainnet verrouillé', startMining:'Démarrer le minage', stopMining:'Arrêter le minage', powerTitle:'Choisissez la puissance que Vigi peut utiliser.', hardwareTitle:'Matériel de minage externe', detectHardware:'Détecter le matériel de minage', helpCenter:"Centre d’aide", language:'Langue' };
const pt: Dictionary = { ...en, control:'Controle', telemetry:'Telemetria', node:'Nó', system:'Sistema', help:'Ajuda', title:'Mineração local, isolada por design.', lede:'Controle computação, nó, mineradores externos e acesso à rede em uma interface nativa. Sem shell.', mainnetLocked:'Mainnet bloqueada', startMining:'Iniciar mineração', stopMining:'Parar mineração', powerTitle:'Escolha quanta potência Vigi pode usar.', hardwareTitle:'Hardware externo de mineração', detectHardware:'Detectar hardware de mineração', helpCenter:'Central de ajuda', language:'Idioma' };
const ar: Dictionary = { ...en, control:'التحكم', telemetry:'القياسات', node:'العقدة', sandbox:'العزل', system:'النظام', help:'المساعدة', title:'تعدين محلي ومعزول منذ التصميم.', lede:'تحكم في قدرة الحوسبة وحالة العقدة وأجهزة التعدين الخارجية والوصول إلى الشبكة من واجهة أصلية واحدة.', testnet:'شبكة الاختبار', mainnet:'الشبكة الرئيسية', mainnetLocked:'الشبكة الرئيسية مقفلة', startMining:'بدء التعدين', stopMining:'إيقاف التعدين', powerTitle:'اختر مقدار قدرة الجهاز التي يمكن لـ Vigi استخدامها.', hardwareTitle:'أجهزة التعدين الخارجية', detectHardware:'اكتشاف أجهزة التعدين', helpCenter:'مركز المساعدة', language:'اللغة' };
const zh: Dictionary = { ...en, control:'控制', telemetry:'遥测', node:'节点', sandbox:'沙箱', system:'系统', help:'帮助', title:'本地挖矿，隔离优先。', lede:'在一个原生界面中控制算力、节点状态、外部矿机和网络访问，无需命令行。', testnet:'测试网', mainnet:'主网', mainnetLocked:'主网已锁定', startMining:'开始挖矿', stopMining:'停止挖矿', powerTitle:'选择 Vigi 可使用的设备算力。', hardwareTitle:'外部挖矿硬件', detectHardware:'检测挖矿硬件', helpCenter:'帮助中心', language:'语言' };

export const dictionaries: Record<Locale, Dictionary> = { en, es, de, fr, pt, ar, zh };

export function detectLocale(): Locale {
  const stored = localStorage.getItem('vigi-miner-locale') as Locale | null;
  if (stored && supportedLocales.includes(stored)) return stored;
  const base = navigator.language.toLowerCase().split('-')[0] as Locale;
  return supportedLocales.includes(base) ? base : 'en';
}

export function translator(locale: Locale) {
  const dict = dictionaries[locale] || dictionaries.en;
  return (key: string) => dict[key] ?? dictionaries.en[key] ?? key;
}
