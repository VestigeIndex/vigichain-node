use std::{fs, io::Write, path::Path};

fn push_u16(out: &mut Vec<u8>, value: u16) { out.extend_from_slice(&value.to_le_bytes()); }
fn push_u32(out: &mut Vec<u8>, value: u32) { out.extend_from_slice(&value.to_le_bytes()); }
fn push_i32(out: &mut Vec<u8>, value: i32) { out.extend_from_slice(&value.to_le_bytes()); }

fn build_icon_ico() -> Vec<u8> {
    const W: usize = 32;
    const H: usize = 32;
    let mask_row = ((W + 31) / 32) * 4;
    let image_size = 40 + W * H * 4 + mask_row * H;

    let mut out = Vec::with_capacity(6 + 16 + image_size);
    // ICONDIR
    push_u16(&mut out, 0);
    push_u16(&mut out, 1);
    push_u16(&mut out, 1);
    // ICONDIRENTRY
    out.push(W as u8);
    out.push(H as u8);
    out.push(0);
    out.push(0);
    push_u16(&mut out, 1);
    push_u16(&mut out, 32);
    push_u32(&mut out, image_size as u32);
    push_u32(&mut out, 22);
    // BITMAPINFOHEADER
    push_u32(&mut out, 40);
    push_i32(&mut out, W as i32);
    push_i32(&mut out, (H * 2) as i32);
    push_u16(&mut out, 1);
    push_u16(&mut out, 32);
    push_u32(&mut out, 0);
    push_u32(&mut out, (W * H * 4) as u32);
    push_i32(&mut out, 0);
    push_i32(&mut out, 0);
    push_u32(&mut out, 0);
    push_u32(&mut out, 0);

    // Bottom-up BGRA pixels: dark field with a mint V/bolt mark.
    for y_bottom in 0..H {
        let y = H - 1 - y_bottom;
        for x in 0..W {
            let dx = x as i32 - 16;
            let dy = y as i32;
            let left = (dx + (dy - 7) / 2).abs() <= 2 && (7..=21).contains(&y);
            let right = (dx - (dy - 7) / 2).abs() <= 2 && (7..=21).contains(&y);
            let tip = y >= 19 && (dx.abs() <= (27 - y) as i32 / 2 + 1);
            let mark = left || right || tip;
            let (r, g, b, a) = if mark { (176u8, 255u8, 210u8, 255u8) } else { (7u8, 10u8, 12u8, 255u8) };
            out.extend_from_slice(&[b, g, r, a]);
        }
    }
    // Opaque AND mask.
    out.resize(out.len() + mask_row * H, 0);
    out
}

fn ensure_icon() {
    let dir = Path::new("icons");
    fs::create_dir_all(dir).expect("create Tauri icons directory");
    let path = dir.join("icon.ico");
    let bytes = build_icon_ico();
    let mut file = fs::File::create(path).expect("create deterministic Vigi Miner icon");
    file.write_all(&bytes).expect("write deterministic Vigi Miner icon");
}

fn main() {
    ensure_icon();
    tauri_build::build();
}
