// Generate StockMate app icons
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '..', 'src-tauri', 'icons');
const UI_DIR = path.resolve(__dirname, '..', 'ui');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="url(#bgGrad)"/>
  <rect x="1" y="1" width="510" height="510" rx="63" fill="none" stroke="#30363d" stroke-width="1" opacity="0.5"/>
  <rect x="96" y="304" width="72" height="128" rx="6" fill="url(#barGrad)" opacity="0.85"/>
  <rect x="124" y="280" width="16" height="176" rx="3" fill="#2563eb" opacity="0.4"/>
  <rect x="220" y="224" width="72" height="208" rx="6" fill="url(#barGrad)" opacity="0.9"/>
  <rect x="248" y="200" width="16" height="256" rx="3" fill="#2563eb" opacity="0.45"/>
  <rect x="344" y="128" width="72" height="304" rx="6" fill="url(#barGrad)"/>
  <rect x="372" y="104" width="16" height="352" rx="3" fill="#2563eb" opacity="0.5"/>
  <line x1="132" y1="304" x2="256" y2="224" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  <line x1="256" y1="224" x2="380" y2="128" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  <line x1="380" y1="128" x2="420" y2="104" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
  <line x1="420" y1="104" x2="416" y2="120" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <line x1="420" y1="104" x2="408" y2="108" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
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
