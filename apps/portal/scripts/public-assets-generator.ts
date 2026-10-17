import fs from 'node:fs/promises';
import path from 'node:path';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

import { fmt } from './util';

/**
 * ⚠️ Top-level await is not supported in CommonJS (CJS) modules.
 * Node only supports top-level await in ESM modules ("type": "module").
 */
(async () => {
  const SRC = 'assets/uop-logo.png';
  const OUT = 'public/favicon';

  const args = process.argv.slice(2);
  const generateOG = args.includes('--generate-og');
  const generateFavicons = args.includes('--generate-favicons');

  const checkEnvVars = (generateFavicons: boolean, generateOG: boolean) => {
    if (!generateFavicons && !generateOG) {
      // eslint-disable-next-line no-console
      console.log(
        fmt.yellow('No assets to generate. Set --generate-favicons flag.')
      );
      return;
    }
  };

  checkEnvVars(generateFavicons, generateOG);

  if (generateFavicons) {
    await fs.mkdir(OUT, { recursive: true });
    // All favicon sizes (includes Threads 42x42)
    const pngSizes = [
      16, 32, 42, 48, 57, 60, 72, 76, 114, 120, 144, 152, 167, 180, 192, 256,
      512, 1024,
    ];

    const webpSizes = [16, 32, 42, 48, 72, 144, 192, 512];
    const icoSizes = [16, 32, 48, 256];

    const aliases = new Map([
      [16, 'favicon-16x16'],
      [32, 'favicon-32x32'],
      [42, 'favicon-42x42'],
      [48, 'favicon-48x48'],
      [72, 'android-chrome-72x72'],
      [144, 'android-chrome-144x144'],
      [192, 'android-chrome-192x192'],
      [256, 'favicon-256x256'],
      [512, 'android-chrome-512x512'],
      [57, 'apple-touch-icon-57x57'],
      [60, 'apple-touch-icon-60x60'],
      [76, 'apple-touch-icon-76x76'],
      [114, 'apple-touch-icon-114x114'],
      [120, 'apple-touch-icon-120x120'],
      [152, 'apple-touch-icon-152x152'],
      [167, 'apple-touch-icon-167x167'],
      [180, 'apple-touch-icon-180x180'],
      [1024, 'apple-touch-icon-1024x1024'],
    ]);

    await fs.mkdir(OUT, { recursive: true });

    // --- Generate PNGs (Cyan)
    for (const size of pngSizes) {
      const name = aliases.get(size) ?? `favicon-${size}x${size}`;
      const file = path.join(OUT, `${name}.png`);
      await sharp(SRC, {
        density: Math.max(256, size * 8),
        limitInputPixels: false,
      })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(file);
      // eslint-disable-next-line no-console
      console.log(`${fmt.cyan('PNG')}  ${size}x${size}`);
    }

    // --- Generate WebPs (Magenta)
    for (const size of webpSizes) {
      const name = aliases.get(size) ?? `favicon-${size}x${size}`;
      const file = path.join(OUT, `${name}.webp`);
      await sharp(SRC, {
        density: Math.max(256, size * 8),
        limitInputPixels: false,
      })
        .resize(size, size)
        .webp({ quality: 95 })
        .toFile(file);
      // eslint-disable-next-line no-console
      console.log(`${fmt.magenta('WEBP')} ${size}x${size}`);
    }

    // --- Generate ICO (Yellow)
    const icoFiles = icoSizes.map((s) =>
      path.join(OUT, `favicon-${s}x${s}.png`)
    );
    for (const file of icoFiles) {
      await fs.access(file);
    }
    const icoBuffer = await pngToIco(icoFiles);
    await fs.writeFile(path.join(OUT, 'favicon.ico'), icoBuffer);
    // eslint-disable-next-line no-console
    console.log(`${fmt.yellow('ICO')}   favicon.ico (includes 256x256)`);

    // --- Copy original SVG (Blue)
    await fs.copyFile(SRC, path.join(OUT, 'logo-symbol-icon.svg'));
    // eslint-disable-next-line no-console
    console.log(`${fmt.blue('SVG')}   logo-symbol-icon.svg`);

    // --- Generate site.webmanifest (Bold White)
    const manifest = {
      name: 'SCS PDN Portal',
      short_name: 'SCS PDN Portal',
      start_url: '/',
      scope: '/',
      lang: 'en',
      icons: [
        {
          src: '/favicon/android-chrome-72x72.webp',
          sizes: '72x72',
          type: 'image/webp',
        },
        {
          src: '/favicon/android-chrome-144x144.webp',
          sizes: '144x144',
          type: 'image/webp',
        },
        {
          src: '/favicon/android-chrome-192x192.webp',
          sizes: '192x192',
          type: 'image/webp',
        },
        {
          src: '/favicon/android-chrome-512x512.webp',
          sizes: '512x512',
          type: 'image/webp',
        },
        {
          src: '/favicon/android-chrome-72x72.png',
          sizes: '72x72',
          type: 'image/png',
        },
        {
          src: '/favicon/android-chrome-144x144.png',
          sizes: '144x144',
          type: 'image/png',
        },
        {
          src: '/favicon/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/favicon/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        { src: '/favicon/logo-symbol-icon.svg', type: 'image/svg+xml' },
      ],
      theme_color: '#F9FAFB',
      background_color: '#F9FAFB',
      display: 'standalone',
    };

    await fs.writeFile(
      path.join(OUT, 'site.webmanifest'),
      JSON.stringify(manifest, null, 2)
    );
    // eslint-disable-next-line no-console
    console.log(`${fmt.bold(fmt.white('MANIFEST'))} site.webmanifest`);
  } else {
    // eslint-disable-next-line no-console
    console.log(
      fmt.yellow(
        'Skipping favicon generation (set --generate-favicons flag to enable)'
      )
    );
  }

  if (generateFavicons && !generateOG) {
    // eslint-disable-next-line no-console
    console.log(
      fmt.bold(
        fmt.green(
          '\n✅ All favicon assets, ICO (256x256), and manifest generated successfully.'
        )
      )
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(fmt.bold(fmt.red('\n❌ No assets generated.')));
  }
})();
