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
// the geometry works in signed and floating-point values, where a negative intermediate is a
// number rather than a crash; and it lives in the crate, where `cargo test` actually runs the tests
// at the bottom of this file. A test inside `build.rs` would have been reassuring and never executed.
//
// THE MARK IS VIGICHAIN'S OWN. Vigi Miner carries the same mark as VigiChain, not a mark of its
// own. That mark exists as a 1024-pixel PNG on the website
// (https://vigichain.org/brand/vigichain-symbol-20260907.png); it was traced once into the five
// polygons below — 124 points, which re-rasterised against the original cover the same pixels at an
// intersection-over-union of 0.9957 — so that it can still be drawn from code instead of shipped as
// a file. The framing copies the website's own app icon: the mark spans 439/512 of the width,
// starts 36/512 from the left and 60/512 from the top, pale ink on the same near-black ground.
//
// `build.rs` includes this file directly, so it must stay dependency-free.

/// The mark, in the 1024-unit space of the source symbol: five filled shapes, left to right.
pub const MARK: [&[(i16, i16)]; 5] = [
    &[(52, 103), (52, 126), (54, 141), (59, 163), (66, 185), (87, 227), (100, 245), (114, 260), (129, 273), (147, 285), (174, 299), (220, 316), (237, 320), (294, 338), (316, 347), (347, 363), (371, 379), (387, 392), (416, 421), (435, 445), (435, 443), (410, 396), (318, 231), (301, 206), (277, 181), (251, 162), (216, 145), (171, 132), (163, 131)],
    &[(139, 308), (282, 554), (375, 709), (399, 751), (402, 754), (498, 594), (437, 488), (418, 459), (394, 430), (363, 402), (332, 381), (287, 360), (193, 331), (162, 319)],
    &[(883, 308), (860, 319), (829, 331), (788, 344), (764, 350), (735, 360), (709, 371), (690, 381), (665, 397), (646, 412), (616, 443), (595, 471), (437, 737), (414, 773), (414, 776), (423, 792), (460, 849), (471, 863), (494, 885), (506, 891), (515, 891), (524, 887), (536, 878), (550, 863), (570, 836), (598, 792), (644, 713), (713, 599), (824, 409), (831, 399)],
    &[(511, 160), (484, 188), (471, 204), (453, 231), (440, 257), (434, 273), (428, 298), (426, 318), (429, 353), (438, 386), (454, 426), (462, 442), (467, 456), (511, 556), (581, 393), (589, 368), (595, 337), (595, 309), (593, 294), (589, 277), (581, 255), (567, 228), (553, 207), (538, 188)],
    &[(970, 103), (839, 135), (808, 144), (766, 165), (752, 175), (736, 189), (720, 207), (702, 234), (615, 390), (587, 444), (613, 413), (635, 392), (658, 374), (680, 360), (699, 350), (733, 336), (781, 321), (798, 317), (841, 302), (873, 286), (900, 267), (922, 245), (941, 217), (952, 195), (961, 170), (968, 141), (970, 125)],
];

/// Each shape's bounding box as (left, top, right, bottom), so a point skips shapes it cannot be in.
const MARK_BOUNDS: [(i16, i16, i16, i16); 5] = [
    (52, 103, 435, 445),
    (139, 308, 498, 754),
    (414, 308, 883, 891),
    (426, 160, 595, 556),
    (587, 103, 970, 444),
];

/// The mark's extent in the symbol's 1024-unit space: left edge, top edge, width.
const MARK_LEFT: f64 = 52.0;
const MARK_TOP: f64 = 103.0;
const MARK_SPAN: f64 = 918.0;

/// Colours sampled from the website's app icon, so the two cannot drift apart by eye.
const GROUND: (u8, u8, u8) = (2, 7, 13);
const INK: (u8, u8, u8) = (226, 236, 246);

/// Is this point, in the symbol's own space, inside the mark?
///
/// Even-odd ray casting. The five shapes neither overlap nor contain holes, so one crossing count
/// across all of them is exact; the bounding boxes only skip shapes a point cannot be in.
fn inside(px: f64, py: f64) -> bool {
    let mut hit = false;
    for (shape, &(x0, y0, x1, y1)) in MARK.iter().zip(MARK_BOUNDS.iter()) {
        if px < x0 as f64 || px > x1 as f64 || py < y0 as f64 || py > y1 as f64 {
            continue;
        }
        let n = shape.len();
        let mut j = n - 1;
        for i in 0..n {
            let (xi, yi) = (shape[i].0 as f64, shape[i].1 as f64);
            let (xj, yj) = (shape[j].0 as f64, shape[j].1 as f64);
            if (yi > py) != (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi {
                hit = !hit;
            }
            j = i;
        }
    }
    hit
}

/// Where a point of a `width`-pixel icon lands in the symbol's space. Icons are square, so one
/// scale serves both axes.
fn to_symbol(x: f64, y: f64, width: i32) -> (f64, f64) {
    let size = width as f64;
    let scale = size * 439.0 / 512.0 / MARK_SPAN;
    let left = size * 36.0 / 512.0;
    let top = size * 60.0 / 512.0;
    (MARK_LEFT + (x - left) / scale, MARK_TOP + (y - top) / scale)
}

/// Is this pixel part of the mark? Sampled at the pixel's centre.
pub fn is_mark(x: i32, y: i32, width: i32, _height: i32) -> bool {
    let (px, py) = to_symbol(x as f64 + 0.5, y as f64 + 0.5, width);
    inside(px, py)
}

/// How much of this pixel the mark covers, in sixteenths: a 4×4 grid of samples, so the curves of
/// the leaves are smooth at 256 pixels instead of stepped.
pub fn coverage(x: i32, y: i32, width: i32, _height: i32) -> u32 {
    let mut hits = 0;
    for j in 0..4 {
        for i in 0..4 {
            let sx = x as f64 + (2 * i + 1) as f64 / 8.0;
            let sy = y as f64 + (2 * j + 1) as f64 / 8.0;
            let (px, py) = to_symbol(sx, sy, width);
            if inside(px, py) {
                hits += 1;
            }
        }
    }
    hits
}

/// The pixel's colour: ground and ink mixed by coverage, always opaque.
fn pixel(x: i32, y: i32, width: i32, height: i32) -> (u8, u8, u8, u8) {
    let c = coverage(x, y, width, height);
    let mix = |g: u8, i: u8| ((g as u32 * (16 - c) + i as u32 * c + 8) / 16) as u8;
    (mix(GROUND.0, INK.0), mix(GROUND.1, INK.1), mix(GROUND.2, INK.2), 255)
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

    // Bottom-up BGRA.
    for y_bottom in 0..H {
        let y = (H - 1 - y_bottom) as i32;
        for x in 0..W {
            let (r, g, b, a) = pixel(x as i32, y, W as i32, H as i32);
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
            let (r, g, b, a) = pixel(x as i32, y as i32, size as i32, size as i32);
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

    /// It is VigiChain's V and not some other shape: the centre leaf is ink, the notch above it
    /// between the two outer leaves is ground, and so are the corners.
    #[test]
    fn the_mark_is_vigichains_v() {
        // Symbol (512, 350) is inside the centre leaf; (512, 120) is above it, between the leaves.
        assert!(is_mark(256, 178, 512, 512), "centre leaf");
        assert!(!is_mark(256, 68, 512, 512), "notch above the centre leaf");
        for &(x, y) in &[(2, 2), (509, 2), (2, 509), (509, 509)] {
            assert!(!is_mark(x, y, 512, 512), "corner ({x}, {y})");
        }
    }

    /// The traced table is the thing reviewers read, so it has to be self-consistent: every box
    /// really bounds its shape, and every shape is a polygon rather than a stray point.
    #[test]
    fn the_traced_table_is_consistent() {
        for (shape, &(x0, y0, x1, y1)) in MARK.iter().zip(MARK_BOUNDS.iter()) {
            assert!(shape.len() >= 3, "a shape needs at least three points");
            for &(x, y) in shape.iter() {
                assert!(x >= x0 && x <= x1 && y >= y0 && y <= y1, "point outside its box");
            }
        }
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
