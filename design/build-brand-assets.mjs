import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const sharp = require('sharp');
const master = fileURLToPath(new URL('apaar_garage_rc_racing_logo.png', import.meta.url));
const output = new URL('../client/public/logo/', import.meta.url);
const background = '#0b0d10';
const transparent = '#0000';
const save = (file, data) => writeFile(new URL(file, output), data);

await mkdir(output, { recursive: true });

const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let left = info.width;
let top = info.height;
let right = 0;
let bottom = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] <= 16) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
}
if (right <= left || bottom <= top) throw new Error('The master has no visible logo.');
const logo = await sharp(master)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png()
  .toBuffer();

for (const scale of [1, 2]) {
  const stem = scale === 1 ? 'header' : 'header@2x';
  const size = sharp(logo).resize(140 * scale, 75 * scale, { fit: 'contain', background: transparent });
  await save(stem + '.webp', await size.clone().webp({ quality: 87, effort: 6 }).toBuffer());
  await save(stem + '.png', await size.png({ palette: true, colours: 192, effort: 10 }).toBuffer());
}

await save('display.webp', await sharp(logo)
  .resize(560, 300, { fit: 'contain', background: transparent })
  .webp({ quality: 89, effort: 6 })
  .toBuffer());

// A simplified trace of the master artwork's red wheel reads at favicon sizes.
const wheel = await readFile(new URL('wheel.svg', import.meta.url));
await save('favicon.svg', wheel);

async function icon(size, fraction, maskable = false) {
  const pixels = Math.round(size * fraction);
  const mark = await sharp(wheel, { density: 576 }).resize(pixels).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: maskable ? background : transparent },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ palette: true, colours: 32, dither: 0, effort: 10 })
    .toBuffer();
}

await save('apple-touch-icon.png', await icon(180, 0.76, true));
await save('icon-192.png', await icon(192, 0.88));
await save('icon-512.png', await icon(512, 0.88));
await save('icon-maskable-512.png', await icon(512, 0.72, true));
await save('organization.png', await sharp(logo)
  .resize(192, 192, { fit: 'contain', background })
  .png({ palette: true, colours: 128, effort: 10 })
  .toBuffer());

const faviconSizes = [16, 32, 48];
const frames = await Promise.all(faviconSizes.map((size) => icon(size, 1)));
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = faviconSizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await save('favicon.ico', Buffer.concat([directory, ...frames]));

const shareBackground = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="amber" cx="50%" cy="59%" r="66%">
        <stop stop-color="#4a2d21"/><stop offset="1" stop-color="#0b0d10"/>
      </radialGradient>
    </defs>
    <path fill="url(#amber)" d="M0 0h1200v630H0z"/>
    <text x="600" y="530" fill="#f2b16c" text-anchor="middle" font-family="Arial, sans-serif"
          font-size="40" font-weight="700" letter-spacing="8">BUILT TO COLLECT.</text>
  </svg>
`);
const shareLogo = await sharp(logo).resize(680).png().toBuffer();
await save('share.jpg', await sharp(shareBackground)
  .composite([{ input: shareLogo, top: 92, left: 260 }])
  .jpeg({ quality: 87, mozjpeg: true })
  .toBuffer());
