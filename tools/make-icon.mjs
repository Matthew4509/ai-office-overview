// Makes public/app.ico (the shortcuts' and the installer's icon) from public/icon.svg, with nothing but Node.js.
// The icon is a few rounded rectangles and circles, so it is drawn here pixel by pixel (16 samples per pixel for
// smooth edges) and written as a PNG at each size inside one .ico. Run it again whenever icon.svg changes:
//   node tools/make-icon.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const here = path.join(import.meta.dirname, '..');
const svg = fs.readFileSync(path.join(here, 'public', 'icon.svg'), 'utf8');
const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
if (!box) throw new Error('icon.svg needs a viewBox starting at 0 0');
const UNITS = Number(box[1]);

// The shapes, in the order drawn. Only what icon.svg uses: rect (with rx) and circle, each with a solid fill.
const num = (attrs, name, fallback = 0) => { const m = new RegExp(`\\b${name}="([\\d.]+)"`).exec(attrs); return m ? Number(m[1]) : fallback; };
const colour = (attrs) => { const m = /fill="#([0-9a-f]{3,6})"/i.exec(attrs); if (!m) throw new Error(`a shape without a solid fill: ${attrs}`); const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const shapes = [];
for (const [, tag, attrs] of svg.matchAll(/<(rect|circle)\b([^>]*)\/?>/g)) {
  if (tag === 'rect') shapes.push({ kind: 'rect', x: num(attrs, 'x'), y: num(attrs, 'y'), w: num(attrs, 'width'), h: num(attrs, 'height'), r: num(attrs, 'rx'), fill: colour(attrs) });
  else shapes.push({ kind: 'circle', cx: num(attrs, 'cx'), cy: num(attrs, 'cy'), r: num(attrs, 'r'), fill: colour(attrs) });
}
if (!shapes.length) throw new Error('no rect or circle found in icon.svg');

function inside(s, x, y) {
  if (s.kind === 'circle') return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
  if (x < s.x || y < s.y || x > s.x + s.w || y > s.y + s.h) return false;
  const r = Math.min(s.r, s.w / 2, s.h / 2);
  if (!r) return true;
  const dx = Math.max(s.x + r - x, 0, x - (s.x + s.w - r));
  const dy = Math.max(s.y + r - y, 0, y - (s.y + s.h - r));
  return dx * dx + dy * dy <= r * r;
}

/** RGBA pixels at one size: every shape in turn, each sample point taking the colour of the last shape it is in. */
function raster(size) {
  const S = 4; // samples per side of a pixel
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = ((pxl + (sx + 0.5) / S) / size) * UNITS, y = ((py + (sy + 0.5) / S) / size) * UNITS;
          let hit = null;
          for (const s of shapes) if (inside(s, x, y)) hit = s.fill;
          if (hit) { r += hit[0]; g += hit[1]; b += hit[2]; a++; }
        }
      }
      const i = (py * size + pxl) * 4;
      if (a) { px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a); px[i + 3] = Math.round((a / (S * S)) * 255); }
    }
  }
  return px;
}

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = raster(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { rows[y * (size * 4 + 1)] = 0; px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// One .ico with a PNG entry per size (Windows reads PNG entries since Vista; 256 is the largest an .ico can name).
const SIZES = [256, 64, 48, 32, 24, 16];
const images = SIZES.map(png);
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(SIZES.length, 4);
const dir = Buffer.alloc(16 * SIZES.length);
let offset = 6 + dir.length;
SIZES.forEach((size, i) => {
  const e = i * 16;
  dir[e] = size === 256 ? 0 : size; dir[e + 1] = size === 256 ? 0 : size; dir[e + 2] = 0; dir[e + 3] = 0;
  dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(images[i].length, e + 8); dir.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
const out = path.join(here, 'public', 'app.ico');
fs.writeFileSync(out, Buffer.concat([header, dir, ...images]));
console.log(`Written: ${path.relative(here, out)} (${SIZES.join(', ')} px, ${shapes.length} shapes)`);
