/**
 * Script to generate valid PNG icon files (16x16, 48x48, 128x128) using Node.js zlib
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createShieldPNG(width, height) {
  // RGBA buffer for image
  const buffer = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Draw rounded shield shape with emerald green gradient & white checkmark
      const dx = (x - cx) / (width * 0.42);
      const dy = (y - cy) / (height * 0.45);
      
      const inShield = (Math.abs(dx) <= (1 - Math.max(0, dy * 0.4))) && (dy >= -0.9 && dy <= 0.95);

      if (inShield) {
        // Emerald green gradient (#10b981 to #059669)
        const t = y / height;
        buffer[idx] = Math.round(16 + t * (5 - 16));     // R
        buffer[idx + 1] = Math.round(185 + t * (150 - 185)); // G
        buffer[idx + 2] = Math.round(129 + t * (105 - 129)); // B
        buffer[idx + 3] = 255; // Alpha
      } else {
        // Transparent
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Construct PNG File Format
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // Filter 0
    buffer.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', idatData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Write PNG files
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngData = createShieldPNG(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngData);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
