// Renders every raster brand asset from the SVG sources, so icons can be rebuilt if the accent or
// the mark changes. Sources of truth: public/logo.svg (5 bars) and public/logo-small.svg (3 bars).
//   node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const ACCENT = "#0B5D4B"; // default accent; the PWA icons always use it (SPEC: app icons keep the default)
const INK = "#12211C";
const WHITE = "#FFFFFF";

// Geometry of the mark inside its own viewBox, taken from the SVG files below.
const MARK = { x: 7, y: 18, w: 50, h: 28 };

const readRects = (file, color) => {
  const svg = readFileSync(file, "utf8");
  const rects = svg.match(/<rect[^>]*\/>/g) ?? [];
  if (rects.length === 0) throw new Error(`no <rect> found in ${file}`);
  return rects.join("\n  ").replaceAll("currentColor", color);
};

const mainBars = (color) => readRects("public/logo.svg", color);
const smallBars = (color) => readRects("public/logo-small.svg", color);

/** The mark scaled to `fraction` of the canvas side and centred, on a transparent canvas. */
function markSvg({ side, color, fraction, bars }) {
  const k = (side * fraction) / MARK.w;
  const tx = (side - MARK.w * k) / 2 - MARK.x * k;
  const ty = (side - MARK.h * k) / 2 - MARK.y * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">
  <g transform="translate(${tx} ${ty}) scale(${k})">
  ${bars(color)}
  </g>
</svg>
`;
}

/** App icon: rounded square (22.5% of the side) in the accent, white mark at 72% of the side. */
function appIconSvg(side) {
  const r = side * 0.225;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">
  <rect width="${side}" height="${side}" rx="${r}" ry="${r}" fill="${ACCENT}"/>
  <g transform="translate(${(side - MARK.w * (side * 0.72 / MARK.w)) / 2 - MARK.x * (side * 0.72 / MARK.w)} ${(side - MARK.h * (side * 0.72 / MARK.w)) / 2 - MARK.y * (side * 0.72 / MARK.w)}) scale(${side * 0.72 / MARK.w})">
  ${mainBars(WHITE)}
  </g>
</svg>
`;
}

/** Maskable icon: accent fills the whole canvas, no rounding, mark shrunk to 56% to survive cropping. */
function maskableSvg(side) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">
  <rect width="${side}" height="${side}" fill="${ACCENT}"/>
  <g transform="translate(${(side - MARK.w * (side * 0.56 / MARK.w)) / 2 - MARK.x * (side * 0.56 / MARK.w)} ${(side - MARK.h * (side * 0.56 / MARK.w)) / 2 - MARK.y * (side * 0.56 / MARK.w)}) scale(${side * 0.56 / MARK.w})">
  ${mainBars(WHITE)}
  </g>
</svg>
`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** ICO container holding PNG frames (valid since Vista; used by every current browser). */
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)]);
}

const write = (path, buf) => {
  writeFileSync(path, buf);
  console.log("wrote", path, buf.length, "bytes");
};

// 1. App icons used by the manifest and the head (default accent, never the user's choice).
write("public/icons/icon-192.png", await png(appIconSvg(192), 192));
write("public/icons/icon-512.png", await png(appIconSvg(512), 512));
// 2. Maskable: full-bleed accent, smaller mark, safe from the platform's crop.
write("public/icons/maskable-192.png", await png(maskableSvg(192), 192));
write("public/icons/maskable-512.png", await png(maskableSvg(512), 512));
// 3. iOS home screen: opaque, full bleed (iOS rounds the corners itself).
write("public/icons/apple-touch-icon.png", await sharp(Buffer.from(maskableSvg(180)), { density: 300 }).resize(180, 180).flatten({ background: ACCENT }).png({ compressionLevel: 9 }).toBuffer());

// 4. favicon.ico: 16 px uses the small mark, 32 px the main mark, both on the accent tile so the tab
//    icon stays visible on light and dark browser chrome.
write("public/favicon.ico", ico([
  { size: 16, data: await png(markSvg({ side: 16, color: WHITE, fraction: 0.72, bars: smallBars }), 16) },
  { size: 32, data: await png(markSvg({ side: 32, color: WHITE, fraction: 0.72, bars: mainBars }), 32) },
]));
