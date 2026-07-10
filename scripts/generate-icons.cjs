// Generate StockMate app icons
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '..', 'src-tauri', 'icons');
const UI_DIR = path.resolve(__dirname, '..', 'ui');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
  </defs>
  <!-- Dark terminal-style rounded square background -->
  <rect width="512" height="512" rx="64" fill="url(#bg)"/>
  <!-- Crisp "S" monogram — solid accent blue, no gradient, butt caps for sharp edges.
       96px stroke → at 32px = 6px, at 16px = 3px — always legible. -->
  <path d="M 160 128
           C 400 128, 400 208, 256 208
           C 112 208, 112 336, 352 336
           C 400 336, 400 400, 160 400"
        fill="none" stroke="#2563eb" stroke-width="96" stroke-linecap="butt" stroke-linejoin="miter"/>
</svg>`;

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), SVG);
  console.log('icon.svg written (' + Buffer.from(SVG).length + ' bytes)');

  const sizes = [
    ['32x32.png', 32],
    ['64x64.png', 64],
    ['128x128.png', 128],
    ['128x128@2x.png', 256],
    ['256x256.png', 256],
    ['icon-512.png', 512],
    ['icon.png', 512],
  ];

  for (const [name, size] of sizes) {
    const out = path.join(ICONS_DIR, name);
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(out);
    const stat = fs.statSync(out);
    console.log(name + ' (' + size + 'x' + size + ') - ' + stat.size + ' bytes');
  }

  // Generate favicon for ui/public/
  const pub = path.join(UI_DIR, 'public');
  fs.mkdirSync(pub, { recursive: true });
  await sharp(Buffer.from(SVG)).resize(32, 32).png().toFile(path.join(pub, 'favicon.png'));
  console.log('ui/public/favicon.png written');
}

main().catch(console.error);
