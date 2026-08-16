// Script to generate modern PNG icons for Form Secretary extension
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createPNG(size) {
  const width = size;
  const height = size;

  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  const centerX = size / 2;
  const centerY = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Squircle / rounded box
      const cornerRadius = size * 0.28;
      const qx = Math.max(
        0,
        Math.abs(x - centerX) - (size * 0.44 - cornerRadius),
      );
      const qy = Math.max(
        0,
        Math.abs(y - centerY) - (size * 0.44 - cornerRadius),
      );
      const boxDist = Math.sqrt(qx * qx + qy * qy);

      if (boxDist <= cornerRadius) {
        // Calming Blue gradient background
        const t = (x + y) / (width + height);
        const r = Math.round(59 * (1 - t) + 37 * t); // #3b82f6 to #2563eb
        const g = Math.round(130 * (1 - t) + 99 * t);
        const b = Math.round(246 * (1 - t) + 235 * t);

        const nx = x / size;
        const ny = y / size;

        let isGlyph = false;
        let isSpark = false;

        // Vertical bar
        if (nx >= 0.28 && nx <= 0.4 && ny >= 0.24 && ny <= 0.76) {
          isGlyph = true;
        }
        // Top horizontal bar
        if (nx >= 0.28 && nx <= 0.72 && ny >= 0.24 && ny <= 0.38) {
          isGlyph = true;
        }
        // Middle horizontal bar
        if (nx >= 0.28 && nx <= 0.6 && ny >= 0.46 && ny <= 0.58) {
          isGlyph = true;
        }
        // Spark symbol
        const sx = nx - 0.72;
        const sy = ny - 0.68;
        const starDist = Math.abs(sx) + Math.abs(sy);
        if (starDist < 0.13) {
          isSpark = true;
        }

        if (isSpark) {
          // Soft Emerald green sparkle
          rawData[pxOffset] = 52;
          rawData[pxOffset + 1] = 211;
          rawData[pxOffset + 2] = 153;
          rawData[pxOffset + 3] = 255;
        } else if (isGlyph) {
          // Crisp White glyph
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          // Calming Blue
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrChunk = Buffer.alloc(13);
  ihdrChunk.writeUInt32BE(width, 0);
  ihdrChunk.writeUInt32BE(height, 4);
  ihdrChunk[8] = 8;
  ihdrChunk[9] = 6;
  ihdrChunk[10] = 0;
  ihdrChunk[11] = 0;
  ihdrChunk[12] = 0;

  const ihdr = makeChunk("IHDR", ihdrChunk);
  const idat = makeChunk("IDAT", idatData);
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = crc32(typeAndData);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

const outDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 32, 48, 128].forEach((size) => {
  const pngBuf = createPNG(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated icon${size}.png (${size}x${size})`);
});
