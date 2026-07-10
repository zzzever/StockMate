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
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <!-- Dark terminal-style rounded square background -->
  <rect width="512" height="512" rx="64" fill="url(#bg)"/>
  <!--
    Geometric "S" mark — constructed from staggered thick bars.
    Simultaneously reads as:
    (a) The letter "S" — StockMate brand monogram
    (b) An ascending stock chart — three levels stepping up and right
  -->
  <path d="M 128 80 L 384 80 L 384 176 L 128 176 L 128 336 L 384 336 L 384 432 L 128 432"
        fill="none" stroke="url(#accent)" stroke-width="96" stroke-linecap="butt" stroke-linejoin="miter"/>
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
