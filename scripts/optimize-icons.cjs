const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 统一使用项目根目录，确保从 scripts 目录运行也能找到资源
const root = path.join(__dirname, '..');

async function optimizePurpleIcons() {
  const inputPath = path.join(root, 'public', 'icon-2160.png');
  const publicDir = path.join(root, 'public');

  console.log('开始优化紫色系图标...');
  console.log('输入文件:', inputPath);

  // 检查输入文件是否存在
  if (!fs.existsSync(inputPath)) {
    console.error('输入文件不存在:', inputPath);
    return;
  }

  try {
    // 获取原始图片信息
    const metadata = await sharp(inputPath).metadata();
    console.log('原始图片信息:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: `${(fs.statSync(inputPath).size / 1024 / 1024).toFixed(2)}MB`
    });

    // 创建圆角遮罩函数
    const createRoundedCornerMask = (size, radius) => {
      const svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
        </svg>
      `;
      return Buffer.from(svg);
    };

    // 生成512x512图标（带圆角）
    console.log('生成512x512图标...');
    const mask512 = createRoundedCornerMask(512, 64); // 12.5%圆角
    await sharp(inputPath)
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: mask512,
          blend: 'dest-in'
        }
      ])
      .png({
        quality: 95,
        compressionLevel: 9,
        progressive: true
      })
      .toFile(path.join(publicDir, 'icon-512.png'));

    // 生成192x192图标（带圆角）
    console.log('生成192x192图标...');
    const mask192 = createRoundedCornerMask(192, 24); // 12.5%圆角
    await sharp(inputPath)
      .resize(192, 192, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: mask192,
          blend: 'dest-in'
        }
      ])
      .png({
        quality: 95,
        compressionLevel: 9,
        progressive: true
      })
      .toFile(path.join(publicDir, 'icon-192.png'));

    // 生成Android图标（用于Capacitor）
    console.log('生成Android图标...');
    const androidSizes = [
      { size: 36, name: 'ldpi' },
      { size: 48, name: 'mdpi' },
      { size: 72, name: 'hdpi' },
      { size: 96, name: 'xhdpi' },
      { size: 144, name: 'xxhdpi' },
      { size: 192, name: 'xxxhdpi' }
    ];

    // 创建Android资源目录
    const androidResDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

    for (const { size, name } of androidSizes) {
      const densityDir = path.join(androidResDir, `mipmap-${name}`);
      if (!fs.existsSync(densityDir)) {
        fs.mkdirSync(densityDir, { recursive: true });
      }

      // 生成圆角图标
      const mask = createRoundedCornerMask(size, Math.round(size * 0.125));
      await sharp(inputPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .composite([
          {
            input: mask,
            blend: 'dest-in'
          }
        ])
        .png({
          quality: 95,
          compressionLevel: 9
        })
        .toFile(path.join(densityDir, 'ic_launcher.png'));

      // 生成圆形图标（Android Adaptive Icon）
      const circleMask = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
        </svg>
      `;

      await sharp(inputPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .composite([
          {
            input: Buffer.from(circleMask),
            blend: 'dest-in'
          }
        ])
        .png({
          quality: 95,
          compressionLevel: 9
        })
        .toFile(path.join(densityDir, 'ic_launcher_round.png'));
    }

    // 生成高质量的favicon（32x32）
    console.log('生成favicon...');
    const mask32 = createRoundedCornerMask(32, 4);
    await sharp(inputPath)
      .resize(32, 32, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: mask32,
          blend: 'dest-in'
        }
      ])
      .png({
        quality: 95,
        compressionLevel: 9
      })
      .toFile(path.join(publicDir, 'favicon.png'));

    // 检查生成的文件大小
    console.log('\n优化结果:');
    const files = ['icon-512.png', 'icon-192.png', 'favicon.png'];

    for (const file of files) {
      const filePath = path.join(publicDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const metadata = await sharp(filePath).metadata();
        console.log(`${file}: ${metadata.width}x${metadata.height}, ${(stats.size / 1024).toFixed(2)}KB`);
      }
    }

    console.log('\n紫色系图标优化完成！');
    console.log('- 已生成带圆角的512x512和192x192图标');
    console.log('- 已生成Android各密度图标');
    console.log('- 已生成高质量favicon');
    console.log('- 文件大小已大幅优化');
    console.log('- 保持了紫色系的视觉效果');
  } catch (error) {
    console.error('优化过程中出错:', error);
  }
}

// 运行优化
optimizePurpleIcons();
