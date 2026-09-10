// The application icon, generated rather than committed — and testable.
//
// Tauri needs an `.ico` on Windows. A binary blob in a repository whose policy is "nothing
// unattested in the tree" is exactly the kind of file nobody ever re-reads, so the mark is drawn
// from code: reviewable as text, identical on every machine, and free of any asset dependency at
// build time.
//
// WHY THE ARITHMETIC HERE IS SIGNED, AND WHY THIS FILE IS NOT INSIDE `build.rs`:
// the first version computed `(27 - y) / 2` with `y: usize`. On the bottom four rows of a
// 32-pixel icon that subtraction goes below zero, which in a debug build panics — and a build
// script that panics fails the crate before one line of the application is compiled. Every
// `cargo check` on Windows and on Linux died at `build.rs:48` with "attempt to subtract with
// overflow", so this application's CI had never been green once. Two changes follow from that:
// the geometry works in `i32`, where a negative intermediate value is a number rather than a
// crash; and it lives in the crate, where `cargo test` actually runs the tests at the bottom of
// this file. A test inside `build.rs` would have been reassuring and never executed.
//
// `build.rs` includes this file directly, so it must stay dependency-free.

/// Is this pixel part of the mark?
///
/// The shape is a "V": two strokes descending towards the centre, closed by a short tip.
pub fn is_mark(x: i32, y: i32, width: i32, height: i32) -> bool {
    let centre = width / 2;
    let dx = x - centre;
    // The strokes start a fifth of the way down and end a fifth from the bottom, so the mark sits
    // inside the icon's optical square instead of touching its edges.
    let top = height / 5;
    let bottom = height - height / 5;
    if y < top || y > bottom {
        return false;
    }
    let descent = (y - top) / 2;
    let left_stroke = (dx + descent).abs() <= 2;
    let right_stroke = (dx - descent).abs() <= 2;
    let tip = y >= bottom - 3 && dx.abs() <= (bottom - y) + 1;
    left_stroke || right_stroke || tip
}

fn push_u16(out: &mut Vec<u8>, value: u16) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn push_i32(out: &mut Vec<u8>, value: i32) {
    out.extend_from_slice(&value.to_le_bytes());
}

/// A complete 32×32, 32-bit ICO file: directory, bitmap header, BGRA pixels, opaque AND mask.
pub fn build_icon_ico() -> Vec<u8> {
    const W: usize = 32;
    const H: usize = 32;
    // Rows of the AND mask are padded to a multiple of four bytes, as the format requires.
    let mask_row = ((W + 31) / 32) * 4;
    let image_size = 40 + W * H * 4 + mask_row * H;

    let mut out = Vec::with_capacity(6 + 16 + image_size);
    // ICONDIR: reserved, type 1 (icon), one image.
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
    // BITMAPINFOHEADER — the height is doubled because the AND mask follows the colour data.
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

    // Bottom-up BGRA: the product's near-black ground, with the mark in its mint accent.
    for y_bottom in 0..H {
        let y = (H - 1 - y_bottom) as i32;
        for x in 0..W {
            let (r, g, b, a) = if is_mark(x as i32, y, W as i32, H as i32) {
                (176u8, 255u8, 210u8, 255u8)
            } else {
                (7u8, 10u8, 12u8, 255u8)
            };
            out.extend_from_slice(&[b, g, r, a]);
        }
    }
    // Opaque AND mask: every pixel of a 32-bit icon carries its own alpha.
    out.resize(out.len() + mask_row * H, 0);
    out
}

/// The same mark as a PNG, at any square size.
///
/// Tauri's bundler wants PNGs beside the `.ico` (and macOS wants an `.icns`, which this project
/// does not ship because it does not ship macOS). Rather than take an image crate as a build
/// dependency — or, worse, commit binary files — the encoder is written out here: a PNG is a
/// signature, an IHDR, one IDAT and an IEND, and DEFLATE has a "stored" mode that needs no
/// compressor at all. The result is slightly larger than a compressed PNG and byte-for-byte
/// deterministic, which for a 128-pixel icon is the right trade.
pub fn build_icon_png(size: u32) -> Vec<u8> {
    fn crc32(bytes: &[u8]) -> u32 {
        let mut table = [0u32; 256];
        let mut i = 0;
        while i < 256 {
            let mut c = i as u32;
            let mut k = 0;
            while k < 8 {
                c = if c & 1 != 0 {
                    0xEDB8_8320 ^ (c >> 1)
                } else {
                    c >> 1
                };
                k += 1;
            }
            table[i] = c;
            i += 1;
        }
        let mut crc = 0xFFFF_FFFFu32;
        for &b in bytes {
            crc = table[((crc ^ b as u32) & 0xFF) as usize] ^ (crc >> 8);
        }
        crc ^ 0xFFFF_FFFF
    }

    fn adler32(bytes: &[u8]) -> u32 {
        let (mut a, mut b) = (1u32, 0u32);
        for &byte in bytes {
            a = (a + byte as u32) % 65521;
            b = (b + a) % 65521;
        }
        (b << 16) | a
    }

    fn chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        let mut body = Vec::with_capacity(4 + data.len());
        body.extend_from_slice(kind);
        body.extend_from_slice(data);
        out.extend_from_slice(&body);
        out.extend_from_slice(&crc32(&body).to_be_bytes());
    }

    // Raw scanlines: filter byte 0 (none) followed by RGBA pixels.
    let mut raw = Vec::with_capacity((size as usize) * (size as usize * 4 + 1));
    for y in 0..size {
        raw.push(0);
        for x in 0..size {
            let (r, g, b, a) = if is_mark(x as i32, y as i32, size as i32, size as i32) {
                (176u8, 255u8, 210u8, 255u8)
            } else {
                (7u8, 10u8, 12u8, 255u8)
            };
            raw.extend_from_slice(&[r, g, b, a]);
        }
    }

    // zlib stream with stored (uncompressed) DEFLATE blocks: no compressor, still a valid PNG.
    let mut zlib = vec![0x78, 0x01];
    for (i, block) in raw.chunks(65_535).enumerate() {
        let last = if (i + 1) * 65_535 >= raw.len() {
            1u8
        } else {
            0u8
        };
        zlib.push(last);
        let len = block.len() as u16;
        zlib.extend_from_slice(&len.to_le_bytes());
        zlib.extend_from_slice(&(!len).to_le_bytes());
        zlib.extend_from_slice(block);
    }
    zlib.extend_from_slice(&adler32(&raw).to_be_bytes());

    let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&size.to_be_bytes());
    ihdr.extend_from_slice(&size.to_be_bytes());
    ihdr.extend_from_slice(&[8, 6, 0, 0, 0]); // 8-bit, RGBA, deflate, no filter, no interlace
    chunk(&mut png, b"IHDR", &ihdr);
    chunk(&mut png, b"IDAT", &zlib);
    chunk(&mut png, b"IEND", &[]);
    png
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The bug that kept every build of this application red: the mark must be computable for every
    /// pixel of the icon, including the bottom rows where the old code underflowed a `usize`.
    #[test]
    fn the_mark_is_defined_for_every_pixel() {
        for y in 0..32 {
            for x in 0..32 {
                let _ = is_mark(x, y, 32, 32);
            }
        }
    }

    /// And it has to draw something: an icon that is uniformly background is a bug that compiles.
    #[test]
    fn the_mark_covers_part_of_the_icon_but_not_all_of_it() {
        let marked = (0..32)
            .flat_map(|y| (0..32).map(move |x| (x, y)))
            .filter(|&(x, y)| is_mark(x, y, 32, 32))
            .count();
        assert!(marked > 60, "the mark is nearly invisible: {marked} pixels");
        assert!(
            marked < 512,
            "the mark covers half the icon: {marked} pixels"
        );
    }

    /// The header the ICO format promises, byte for byte, so a malformed icon fails here rather
    /// than inside a Windows shell that simply shows nothing.
    #[test]
    fn the_icon_is_a_well_formed_32_bit_ico() {
        let ico = build_icon_ico();
        assert_eq!(&ico[0..4], &[0, 0, 1, 0], "ICONDIR reserved + type");
        assert_eq!(&ico[4..6], &[1, 0], "exactly one image");
        assert_eq!(ico[6], 32, "width");
        assert_eq!(ico[7], 32, "height");
        let declared = u32::from_le_bytes([ico[14], ico[15], ico[16], ico[17]]) as usize;
        let offset = u32::from_le_bytes([ico[18], ico[19], ico[20], ico[21]]) as usize;
        assert_eq!(offset, 22, "image data starts after the directory");
        assert_eq!(
            ico.len(),
            offset + declared,
            "declared size matches the file"
        );
    }

    /// Deterministic: two builds of the same source produce the same icon, which is what a
    /// reproducible release needs from a generated asset.
    #[test]
    fn the_icon_is_deterministic() {
        assert_eq!(build_icon_ico(), build_icon_ico());
    }

    /// The bundler reads these files with a real PNG decoder, so the header has to be right in the
    /// bytes rather than in intention.
    #[test]
    fn the_png_is_a_well_formed_rgba_image() {
        for size in [32u32, 128, 256] {
            let png = build_icon_png(size);
            assert_eq!(
                &png[0..8],
                &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A],
                "signature"
            );
            assert_eq!(&png[12..16], b"IHDR", "first chunk");
            assert_eq!(
                u32::from_be_bytes([png[16], png[17], png[18], png[19]]),
                size,
                "width"
            );
            assert_eq!(
                u32::from_be_bytes([png[20], png[21], png[22], png[23]]),
                size,
                "height"
            );
            assert_eq!(png[24], 8, "bit depth");
            assert_eq!(png[25], 6, "colour type RGBA");
            assert_eq!(&png[png.len() - 8..png.len() - 4], b"IEND", "last chunk");
        }
    }

    #[test]
    fn the_png_is_deterministic() {
        assert_eq!(build_icon_png(128), build_icon_png(128));
    }
}
