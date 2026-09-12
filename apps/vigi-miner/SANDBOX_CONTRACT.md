# Vigi Miner privacy & sandbox contract v0.1

Vigi Miner uses explicit containment levels. The UI must report the strongest level actually enforced by the current platform and must never upgrade the label for marketing reasons.

## Levels

### 1. `data-isolated`

Minimum baseline:

- dedicated Vigi data/temp directories;
- inherited process environment cleared;
- only required Vigi/system variables reintroduced;
- no wallet seed/private key is accepted by the miner UI;
- hardware discovery disabled until explicit user permission.

This isolates application data but does **not** prevent a same-user process from opening arbitrary files.

### 2. `os-constrained`

Adds operating-system process controls.

Current Windows implementation:

- Job Object process-tree containment;
- `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`;
- hard CPU-rate cap matching the selected compute percentage;
- `data-isolated` baseline.

Current Linux/Unix implementation:

- `PR_SET_NO_NEW_PRIVS` before exec;
- core dumps disabled;
- restrictive `umask(077)`;
- private mode-0700 Vigi directories;
- `data-isolated` baseline.

This is the current desktop target and is the label Vigi Miner reports today.

### 3. `full-sandbox`

Reserved for a future build that additionally enforces tested filesystem/network capability boundaries, for example an AppContainer-style Windows policy or Linux namespace/seccomp/Landlock policy appropriate for a P2P node.

Vigi Miner MUST NOT report `full-sandbox` until those controls are implemented, tested on supported OS versions, and fail closed when unavailable.

## Network privacy

A blockchain node necessarily communicates with peers. Sandbox claims therefore refer to host/resource isolation, not anonymity. Vigi Miner must not claim that mining hides the user's public IP. Optional proxy/Tor routing, if implemented later, is a separate capability and must be explicitly reported.

## External mining hardware

- LAN/USB discovery is opt-in.
- Initial LAN probing is read-only.
- Discovery does not authorize configuration changes.
- Detection does not imply VigiChain PoW compatibility.
- A separate explicit authorization is required before any future adapter may change ASIC settings.

## Compute policy

Power controls represent compute ceilings, not an estimate of electrical wattage.

- Windows: threads + Job Object hard CPU-rate cap.
- Linux/Unix: thread allocation today; OS CPU quota/cgroup integration can be added separately.
- GPU/ASIC power targets must only be shown when a compatible adapter can actually enforce them.

## Fail-closed rules

- If required containment setup fails, terminate the child and do not mine.
- Mainnet launch cannot be enabled through sandbox/config controls.
- Never pass secrets from the parent environment to the node by default.
- Never silently broaden hardware/network permissions.
