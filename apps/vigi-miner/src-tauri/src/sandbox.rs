use std::{fs,path::PathBuf,process::Command};

pub struct SandboxPaths{pub root:PathBuf,pub data:PathBuf,pub temp:PathBuf}

pub fn prepare(network:&str)->Result<SandboxPaths,String>{
    let home=std::env::var_os("HOME").or_else(||std::env::var_os("USERPROFILE")).ok_or("Unable to resolve user home directory")?;
    let root=PathBuf::from(home).join(".vigichain").join("sandbox").join(network);
    let data=root.join("data");let temp=root.join("tmp");
    fs::create_dir_all(&data).map_err(|e|format!("Unable to create sandbox data dir: {e}"))?;
    fs::create_dir_all(&temp).map_err(|e|format!("Unable to create sandbox temp dir: {e}"))?;
    #[cfg(unix)]{
        use std::os::unix::fs::PermissionsExt;
        for p in [&root,&data,&temp]{fs::set_permissions(p,fs::Permissions::from_mode(0o700)).map_err(|e|format!("Unable to restrict sandbox permissions: {e}"))?;}
    }
    Ok(SandboxPaths{root,data,temp})
}

pub fn apply_baseline(command:&mut Command,paths:&SandboxPaths){
    let path=std::env::var_os("PATH");let system_root=std::env::var_os("SYSTEMROOT");let windir=std::env::var_os("WINDIR");
    command.env_clear();
    if let Some(v)=path{command.env("PATH",v);}if let Some(v)=system_root{command.env("SYSTEMROOT",v);}if let Some(v)=windir{command.env("WINDIR",v);}
    command.current_dir(&paths.root).env("VIGI_DATA_DIR",&paths.data).env("TMP",&paths.temp).env("TEMP",&paths.temp).env("VIGI_SANDBOX","1").env("VIGI_SANDBOX_ROOT",&paths.root);
    #[cfg(unix)]{
        use std::os::unix::process::CommandExt;
        unsafe{
            command.pre_exec(||{
                if libc::prctl(libc::PR_SET_NO_NEW_PRIVS,1,0,0,0)!=0{return Err(std::io::Error::last_os_error());}
                let lim=libc::rlimit{rlim_cur:0,rlim_max:0};
                if libc::setrlimit(libc::RLIMIT_CORE,&lim)!=0{return Err(std::io::Error::last_os_error());}
                libc::umask(0o077);
                Ok(())
            });
        }
    }
}

pub fn capability()->(&'static str,&'static str){
    #[cfg(unix)]{return ("os-constrained","private dirs + cleared environment + no_new_privs + core-dump disabled");}
    #[cfg(windows)]{return ("data-isolated","private dirs + cleared environment; Windows Job Object/AppContainer containment pending");}
    #[allow(unreachable_code)]("data-isolated","private dirs + cleared environment")
}
