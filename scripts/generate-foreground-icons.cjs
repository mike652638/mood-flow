const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
// 支持两种 CLI 传参格式：--mode=xxx 与 --mode xxx；--input=path 与 --input path
const modeEq = args.find(a => a.startsWith('--mode='))?.split('=')[1];
const modeIdx = args.findIndex(a => a === '--mode');
const modeSp = modeIdx !== -1 ? args[modeIdx + 1] : undefined;
const mode = modeEq ?? modeSp ?? 'normal';

const inputEq = args.find(a => a.startsWith('--input='))?.split('=')[1];
const inputIdx = args.findIndex(a => a === '--input');
const inputSp = inputIdx !== -1 ? args[inputIdx + 1] : undefined;
const inputArg = inputEq ?? inputSp;
const root = path.join(__dirname, '..');
// 默认使用 PNG 源，允许传入 SVG 或 PNG
const defaultInput = path.join(root, 'public', 'icon-512.png');
const inputPath = inputArg ? (path.isAbsolute(inputArg) ? inputArg : path.join(root, inputArg)) : defaultInput;
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(inputPath)) {
  console.error('找不到输入文件:', inputPath);
  process.exit(1);
}

const targets = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432]
];

function calcCompact(size) {
  // 内容大小约为画布的 74%，留更多透明边距
  const contentSize = Math.round(size * 0.74);
  const padding = Math.round((size - contentSize) / 2);
  return { contentSize, padding };
}

(async () => {
  for (const [dpi, size] of targets) {
    const outDir = path.join(resDir, `drawable-${dpi}`);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'app_icon_foreground.png');

    if (mode === 'compact' || mode === 'both') {
      const { contentSize, padding } = calcCompact(size);
      const contentBuffer = await sharp(inputPath)
        .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 95, compressionLevel: 9 })
        .toBuffer();

      await sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      })
        .composite([{ input: contentBuffer, top: padding, left: padding }])
        .png({ quality: 95, compressionLevel: 9 })
        .toFile(outFile.replace('.png', '.compact.png'));
      console.log(
        `生成紧凑前景: ${outFile.replace('.png', '.compact.png')} (${size}px, 内容:${contentSize}px, 留白:${padding}px)`
      );
    }

    if (mode === 'normal' || mode === 'both') {
      await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 95, compressionLevel: 9 })
        .toFile(outFile);
      console.log(`生成: ${outFile} (${size}x${size})`);
    }
  }
  console.log('前景各密度 PNG 生成完成');
})();
