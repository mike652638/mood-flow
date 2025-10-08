#!/usr/bin/env node
/**
 * Generate multi-density splash images (portrait & landscape) for Android.
 * Defaults:
 *  - portrait source: public/splash-portrait.png
 *  - landscape source: public/splash-landscape.png
 *  - fallback icon: public/icon-2160.png (or public/icon-512.png)
 * Output:
 *  - android/app/src/main/res/drawable-port-<dpi>/splash.png
 *  - android/app/src/main/res/drawable-land-<dpi>/splash.png
 *  - android/app/src/main/res/drawable/splash.png (baseline for SplashScreen plugin)
 *  - android/app/src/main/res/drawable-land/splash.png (baseline for SplashScreen plugin)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return def;
};

const ROOT = process.cwd();
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const portraitSrc = path.join(ROOT, getArg('portrait', path.join('public', 'splash-portrait.png')));
const landscapeSrc = path.join(ROOT, getArg('landscape', path.join('public', 'splash-landscape.png')));
const fallbackIcon = [path.join(ROOT, 'public', 'icon-2160.png'), path.join(ROOT, 'public', 'icon-512.png')].find(p =>
  fs.existsSync(p)
);
const bgColor = getArg('bg', '#AC7AFD');

const densities = {
  mdpi: { portrait: { width: 360, height: 640 }, landscape: { width: 640, height: 360 } },
  hdpi: { portrait: { width: 480, height: 800 }, landscape: { width: 800, height: 480 } },
  xhdpi: { portrait: { width: 720, height: 1280 }, landscape: { width: 1280, height: 720 } },
  xxhdpi: { portrait: { width: 1080, height: 1920 }, landscape: { width: 1920, height: 1080 } },
  xxxhdpi: { portrait: { width: 1440, height: 2560 }, landscape: { width: 2560, height: 1440 } }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generateFromSource(inputPath, outPath, { width, height }) {
  await sharp(inputPath).resize({ width, height, fit: 'contain', background: bgColor }).png().toFile(outPath);
}

async function generateFromFallback({ width, height }, outPath) {
  if (!fallbackIcon) throw new Error('Fallback icon not found in public/icon-2160.png or icon-512.png');
  const iconSize = Math.round(Math.min(width, height) * 0.38);

  const iconBuf = await sharp(fallbackIcon).resize({ width: iconSize, height: iconSize, fit: 'contain' }).toBuffer();

  const bg = sharp({ create: { width, height, channels: 3, background: bgColor } });

  await bg
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png()
    .toFile(outPath);
}

async function generateAll() {
  console.log('Generating splash images...');

  for (const [dpi, dims] of Object.entries(densities)) {
    const portDir = path.join(RES_DIR, `drawable-port-${dpi}`);
    const landDir = path.join(RES_DIR, `drawable-land-${dpi}`);
    ensureDir(portDir);
    ensureDir(landDir);

    const portOut = path.join(portDir, 'splash.png');
    const landOut = path.join(landDir, 'splash.png');

    // Portrait
    if (fs.existsSync(portraitSrc)) {
      await generateFromSource(portraitSrc, portOut, dims.portrait);
    } else {
      await generateFromFallback(dims.portrait, portOut);
    }

    // Landscape
    if (fs.existsSync(landscapeSrc)) {
      await generateFromSource(landscapeSrc, landOut, dims.landscape);
    } else {
      await generateFromFallback(dims.landscape, landOut);
    }

    console.log(`✓ ${dpi} -> port:${portOut} land:${landOut}`);
  }

  // Also generate baseline resources for Capacitor SplashScreen plugin lookup
  const basePortDir = path.join(RES_DIR, 'drawable');
  const baseLandDir = path.join(RES_DIR, 'drawable-land');
  ensureDir(basePortDir);
  ensureDir(baseLandDir);

  const basePortOut = path.join(basePortDir, 'splash.png');
  const baseLandOut = path.join(baseLandDir, 'splash.png');

  const baseDims = densities.xxhdpi; // reasonable baseline size

  // Baseline portrait
  if (fs.existsSync(portraitSrc)) {
    await generateFromSource(portraitSrc, basePortOut, baseDims.portrait);
  } else {
    await generateFromFallback(baseDims.portrait, basePortOut);
  }

  // Baseline landscape
  if (fs.existsSync(landscapeSrc)) {
    await generateFromSource(landscapeSrc, baseLandOut, baseDims.landscape);
  } else {
    await generateFromFallback(baseDims.landscape, baseLandOut);
  }

  console.log(`✓ base -> drawable:${basePortOut} drawable-land:${baseLandOut}`);

  console.log('All splash images generated successfully.');
}

generateAll().catch(err => {
  console.error('Failed to generate splash images:', err);
  process.exit(1);
});
