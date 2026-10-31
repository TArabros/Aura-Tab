import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, pixelFn) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    // CRC32
    let crc = -1;
    for (let i = 4; i < 8 + len; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        byte = byte >>> 1;
      }
    }
    crc = (crc ^ -1) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with scanline filters (0 = none)
  const rowStride = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowStride));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function renderIcon(x, y, w, h) {
  // Center coordinates normalized -1 to 1
  const nx = (x / (w - 1)) * 2 - 1;
  const ny = (y / (h - 1)) * 2 - 1;

  // Rounded rectangle mask (radius ~ 0.3)
  const rCorner = 0.35;
  const qx = Math.max(0, Math.abs(nx) - (1 - rCorner));
  const qy = Math.max(0, Math.abs(ny) - (1 - rCorner));
  const dist = Math.sqrt(qx * qx + qy * qy);

  if (dist > rCorner) {
    return [0, 0, 0, 0]; // Transparent outside rounded corner
  }

  // Antialias corner edge
  const edgeDist = rCorner - dist;
  const alphaEdge = Math.min(1, Math.max(0, edgeDist * (w / 3)));

  // Gradient background: deep violet #6366f1 to cyan/magenta glow #8b5cf6
  const t = (nx + ny + 2) / 4; // 0 to 1
  let r = Math.round(100 + 40 * t);
  let g = Math.round(70 + 20 * (1 - t));
  let b = Math.round(240 + 15 * t);

  // Star / Sparkle in the middle
  const sx = Math.abs(nx) * 1.8;
  const sy = Math.abs(ny) * 1.8;
  const starDist = Math.pow(sx, 0.6) + Math.pow(sy, 0.6);

  if (starDist < 0.65) {
    const starAlpha = Math.min(1, Math.max(0, (0.65 - starDist) * 3));
    // White spark
    r = Math.round(r * (1 - starAlpha) + 255 * starAlpha);
    g = Math.round(g * (1 - starAlpha) + 255 * starAlpha);
    b = Math.round(b * (1 - starAlpha) + 255 * starAlpha);
  }

  const alpha = Math.round(255 * alphaEdge);
  return [r, g, b, alpha];
}

const iconsDir = path.resolve('public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPNG(size, size, renderIcon);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
