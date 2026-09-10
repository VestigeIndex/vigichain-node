use std::{fs, io::Write, path::Path};

// The icon generator lives in the crate (src/icon.rs) so that `cargo test` runs its tests. It is
// included here rather than imported because a build script cannot depend on the crate it builds,
// and the generator is deliberately dependency-free so that inclusion is enough.
include!("src/icon.rs");

/// Write the whole icon set the bundler needs, before Tauri looks for it.
///
/// `--no-bundle` only ever needed the `.ico`, which is why the portable build was the only one that
/// had a chance of working. An installer — the thing a person actually double-clicks — also wants
/// PNGs, and the bundler fails outright when they are missing. Generating all of them from the same
/// code keeps the app's mark identical at every size and leaves no binary asset in the tree.
fn ensure_icons() {
    let dir = Path::new("icons");
    fs::create_dir_all(dir).expect("create Tauri icons directory");

    let ico = dir.join("icon.ico");
    let mut file = fs::File::create(ico).expect("create deterministic Vigi Miner icon");
    file.write_all(&build_icon_ico()).expect("write deterministic Vigi Miner icon");

    for (name, size) in [
        ("32x32.png", 32u32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
        ("icon.png", 512),
    ] {
        let path = dir.join(name);
        let mut file = fs::File::create(&path).expect("create Vigi Miner PNG icon");
        file.write_all(&build_icon_png(size)).expect("write Vigi Miner PNG icon");
    }
}

fn main() {
    println!("cargo:rerun-if-changed=src/icon.rs");
    ensure_icons();
    tauri_build::build();
}
