#!/usr/bin/env node
/**
 * Single source of truth: admin-web/public/favicon.png (+ favicon.svg for web).
 * Regenerates mobile app icon, splash, and Android adaptive foreground from that file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'admin-web/public/favicon.png');
const MOBILE_IMAGES = path.join(ROOT, 'mobile-app/assets/images');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Install sharp first: npm install --no-save sharp (from repo root or mobile-app)');
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source icon:', SOURCE);
    process.exit(1);
  }

  fs.mkdirSync(MOBILE_IMAGES, { recursive: true });

  const outputs = [
    { file: 'icon.png', size: 1024 },
    { file: 'favicon.png', size: 512 },
    { file: 'android-icon-foreground.png', size: 1024 },
  ];

  for (const { file, size } of outputs) {
    const out = path.join(MOBILE_IMAGES, file);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out);
    console.log('wrote', path.relative(ROOT, out));
  }

  // Keep apple-touch-icon in sync for web
  const appleTouch = path.join(ROOT, 'admin-web/public/apple-touch-icon.png');
  await sharp(SOURCE).resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(appleTouch);
  console.log('wrote', path.relative(ROOT, appleTouch));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
