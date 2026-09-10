use std::process::Child;

// The containment level a running node actually has is reported by `sandbox::capability()`, which
// is the single source the interface reads. This module used to carry a `level()` of its own
// returning the same literal; two sources for one claim is how a claim drifts away from the thing
// it describes, so it was removed rather than wired up twice.

#[cfg(windows)]
pub struct ProcessContainment {
    job: JobHandle,
}

/// A Windows Job Object handle, owned by exactly one `ProcessContainment`.
///
/// WHY THIS WRAPPER EXISTS: `HANDLE` is `*mut c_void`, and a raw pointer is neither `Send` nor
/// `Sync`. The containment lives inside the Tauri-managed miner state, which must be both, so the
/// crate did not compile at all — twelve of its fourteen errors were this one type travelling
/// through `Mutex<Option<RunningMiner>>`.
///
/// The unsafe impls are sound for a reason worth writing down rather than assuming: this is a
/// kernel handle, not a pointer into this process's address space. It is created here, never
/// duplicated, closed exactly once in `Drop`, and every access to the value that holds it goes
/// through the mutex in `MinerProcess`. Moving it between threads is therefore no different from
/// moving an integer, which is what a handle is.
#[cfg(windows)]
struct JobHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandle {}

#[cfg(windows)]
unsafe impl Sync for JobHandle {}

#[cfg(windows)]
impl ProcessContainment {
    pub fn attach(child: &Child, cpu_percent: u8) -> Result<Self, String> {
        use std::{mem::size_of, os::windows::io::AsRawHandle, ptr::null};
        use windows_sys::Win32::{
            Foundation::{CloseHandle, HANDLE},
            System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectCpuRateControlInformation,
                JobObjectExtendedLimitInformation, SetInformationJobObject,
                JOBOBJECT_CPU_RATE_CONTROL_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_CPU_RATE_CONTROL_ENABLE, JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
        };

        if !(10..=100).contains(&cpu_percent) {
            return Err("CPU containment requires a 10-100 percent limit".into());
        }

        unsafe {
            let job = CreateJobObjectW(null(), null());
            if job.is_null() {
                return Err(format!(
                    "CreateJobObjectW failed: {}",
                    std::io::Error::last_os_error()
                ));
            }

            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) == 0
            {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!(
                    "Unable to configure Vigi process tree containment: {e}"
                ));
            }

            let mut cpu: JOBOBJECT_CPU_RATE_CONTROL_INFORMATION = std::mem::zeroed();
            cpu.ControlFlags =
                JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP;
            cpu.Anonymous.CpuRate = u32::from(cpu_percent) * 100;
            if SetInformationJobObject(
                job,
                JobObjectCpuRateControlInformation,
                &cpu as *const _ as *const _,
                size_of::<JOBOBJECT_CPU_RATE_CONTROL_INFORMATION>() as u32,
            ) == 0
            {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!("Unable to apply Windows CPU hard cap: {e}"));
            }

            let process = child.as_raw_handle() as HANDLE;
            if AssignProcessToJobObject(job, process) == 0 {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!(
                    "Unable to attach Vigi node to Windows Job Object: {e}"
                ));
            }

            Ok(Self {
                job: JobHandle(job),
            })
        }
    }
}

#[cfg(windows)]
impl Drop for ProcessContainment {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.job.0);
        }
    }
}

#[cfg(not(windows))]
pub struct ProcessContainment;

#[cfg(not(windows))]
impl ProcessContainment {
    pub fn attach(_child: &Child, _cpu_percent: u8) -> Result<Self, String> {
        Ok(Self)
    }
}
