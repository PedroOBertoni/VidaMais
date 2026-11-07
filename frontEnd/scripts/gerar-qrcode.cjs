const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode-terminal/vendor/QRCode');
const levels = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');
const url = process.argv[2];
if (!url || !url.startsWith('exp://')) {
  console.error('Uso: node scripts/gerar-qrcode.cjs exp://IP_DO_COMPUTADOR:8081');
  process.exit(1);
}
const qr = new QRCode(-1, levels.M);
qr.addData(url);
qr.make();
const margin = 4;
const scale = 12;
const count = qr.getModuleCount();
const size = (count + margin * 2) * scale;
const raw = Buffer.alloc((size + 1) * size, 255);
for (let y = 0; y < size; y++) {
  raw[y * (size + 1)] = 0;
  for (let x = 0; x < size; x++) {
    const row = Math.floor(y / scale) - margin;
    const col = Math.floor(x / scale) - margin;
    if (row >= 0 && col >= 0 && row < count && col < count && qr.isDark(row, col)) raw[y * (size + 1) + x + 1] = 0;
  }
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([length, tag, data, crc]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8; // PNG grayscale, oito bits por pixel.
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const output = path.resolve(__dirname, '../qrcode.png');
fs.writeFileSync(output, png);
console.log(`QR code gerado: ${output}\nEndereço: ${url}`);
