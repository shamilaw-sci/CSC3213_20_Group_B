import { readdir, stat, mkdir, copyFile } from 'fs/promises';
import path from 'path';
import chalk, { type ChalkInstance } from 'chalk';
import crypto from 'crypto';

const SOURCE_DIR = path.resolve('config-overrides');
const TARGET_ROOT = path.resolve('apps');

const isDryRun = process.argv.includes('--dry');

// per-app colors
const appColors = [
  chalk.blue,
  chalk.green,
  chalk.magenta,
  chalk.cyan,
  chalk.yellow,
  chalk.red,
];

// hash helper
async function hashFile(filePath: string) {
  try {
    const content = await Bun.file(filePath).arrayBuffer();

    return crypto.createHash('sha1').update(Buffer.from(content)).digest('hex');
  } catch {
    return null;
  }
}

// tiny diff preview
async function showDiff(src: string, dest: string, color: ChalkInstance) {
  try {
    const [a, b] = await Promise.all([
      Bun.file(dest).text(),
      Bun.file(src).text(),
    ]);

    if (a === b) return;

    console.log(color.dim('  ── diff preview ──'));

    const oldLines = a.split('\n').slice(0, 3);
    const newLines = b.split('\n').slice(0, 3);

    oldLines.forEach((l) => console.log(chalk.red(`- ${l}`)));
    newLines.forEach((l) => console.log(chalk.green(`+ ${l}`)));
  } catch {
    // ignore
  }
}

async function copyRecursive(src: string, dest: string, color: ChalkInstance) {
  const stats = await stat(src);

  if (stats.isDirectory()) {
    await mkdir(dest, { recursive: true });

    const files = await readdir(src);

    for (const file of files) {
      await copyRecursive(path.join(src, file), path.join(dest, file), color);
    }
  } else {
    await mkdir(path.dirname(dest), { recursive: true });

    const [srcHash, destHash] = await Promise.all([
      hashFile(src),
      hashFile(dest),
    ]);

    // skip unchanged
    if (srcHash && destHash && srcHash === destHash) {
      console.log(chalk.gray('• Unchanged'), chalk.dim(dest));
      return;
    }

    const exists = destHash !== null;

    if (exists) {
      await showDiff(src, dest, color);
    }

    if (!isDryRun) {
      await copyFile(src, dest);
    }

    console.log(
      color.bold(
        exists
          ? isDryRun
            ? '↺ Would overwrite'
            : '↺ Overwritten'
          : isDryRun
            ? '✔ Would create'
            : '✔ Created'
      ),
      chalk.dim(dest)
    );
  }
}

async function cleanNestedLocks() {
  console.log(chalk.yellow.bold('🧹 Cleaning nested bun.lock files'));

  let found = false;

  for await (const file of new Bun.Glob('apps/**/bun.lock').scan('.')) {
    found = true;

    if (!isDryRun) {
      await Bun.file(file).delete();
    }

    console.log(
      chalk.gray(isDryRun ? '✖ Would delete' : '✖ Deleted'),
      chalk.dim(file)
    );
  }

  if (!found) {
    console.log(chalk.green('✔ No nested bun.lock files found'));
  }

  console.log();
}

async function main() {
  console.log(
    chalk.bold(`🚀 Config injection ${isDryRun ? '(dry-run)' : ''}\n`)
  );

  // cleanup before injection
  await cleanNestedLocks();

  const apps = await readdir(SOURCE_DIR);

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const color = appColors[i % appColors.length];

    const srcPath = path.join(SOURCE_DIR, app);
    const destPath = path.join(TARGET_ROOT, app);

    console.log(color.bold(`📦 ${app}`));

    await copyRecursive(srcPath, destPath, color);

    console.log();
  }

  console.log(
    chalk.green.bold(`✅ Done ${isDryRun ? '(no changes applied)' : ''}`)
  );
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Injection failed:'), err);
  process.exit(1);
});
