use std::process::Child;

#[cfg(windows)]
pub struct ProcessContainment {
    job: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl ProcessContainment {
    pub fn attach(child: &Child, cpu_percent: u8) -> Result<Self, String> {
        use std::{mem::size_of, os::windows::io::AsRawHandle, ptr::null};
        use windows_sys::Win32::{
            Foundation::{CloseHandle, HANDLE},
            System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
                JobObjectCpuRateControlInformation, JobObjectExtendedLimitInformation,
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
                return Err(format!("CreateJobObjectW failed: {}", std::io::Error::last_os_error()));
            }

            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) == 0 {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!("Unable to configure Vigi process tree containment: {e}"));
            }

            let mut cpu: JOBOBJECT_CPU_RATE_CONTROL_INFORMATION = std::mem::zeroed();
            cpu.ControlFlags = JOB_OBJECT_CPU_RATE_CONTROL_ENABLE | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP;
            cpu.Anonymous.CpuRate = u32::from(cpu_percent) * 100;
            if SetInformationJobObject(
                job,
                JobObjectCpuRateControlInformation,
                &cpu as *const _ as *const _,
                size_of::<JOBOBJECT_CPU_RATE_CONTROL_INFORMATION>() as u32,
            ) == 0 {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!("Unable to apply Windows CPU hard cap: {e}"));
            }

            let process = child.as_raw_handle() as HANDLE;
            if AssignProcessToJobObject(job, process) == 0 {
                let e = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(format!("Unable to attach Vigi node to Windows Job Object: {e}"));
            }

            Ok(Self { job })
        }
    }

    pub fn level(&self) -> &'static str { "os-constrained" }
}

#[cfg(windows)]
impl Drop for ProcessContainment {
    fn drop(&mut self) {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(self.job); }
    }
}

#[cfg(not(windows))]
pub struct ProcessContainment;

#[cfg(not(windows))]
impl ProcessContainment {
    pub fn attach(_child: &Child, _cpu_percent: u8) -> Result<Self, String> { Ok(Self) }
    pub fn level(&self) -> &'static str { "os-constrained" }
}
