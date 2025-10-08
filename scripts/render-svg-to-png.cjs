#!/usr/bin/env node
/**
 * Render an SVG file to a PNG with specified dimensions.
 * Usage: node scripts/render-svg-to-png.cjs <input.svg> <output.png> <width> <height>
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const [input, output, wStr, hStr] = process.argv.slice(2);
  if (!input || !output || !wStr || !hStr) {
    console.error('Usage: node scripts/render-svg-to-png.cjs <input.svg> <output.png> <width> <height>');
    process.exit(1);
  }
  const width = parseInt(wStr, 10);
  const height = parseInt(hStr, 10);
  const inPath = path.resolve(input);
  const outPath = path.resolve(output);
  if (!fs.existsSync(inPath)) {
    console.error('Input SVG not found:', inPath);
    process.exit(1);
  }
  console.log('Rendering', inPath, '->', outPath, `(${width}x${height})`);
  await sharp(inPath, { density: 220 })
    .resize(width, height)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});