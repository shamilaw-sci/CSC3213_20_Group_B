import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');

const productPaletteUtility =
  /(?:bg|border|fill|outline|ring|shadow|stroke|text)-(?:(?:amber|blue|emerald|gray|green|neutral|orange|red|slate|teal|zinc)-\d+|black|white)(?:\/\d+)?|(?:bg|border|fill|outline|ring|shadow|stroke|text)-\[(?:#|rgba?\(|hsla?\(|oklch\(|lab\(|lch\()/gu;

describe('application color system', () => {
  test('TSX classes use semantic tokens instead of embedded colors', () => {
    const sourceFiles = [
      ...new Bun.Glob('apps/*/src/**/*.{ts,tsx}').scanSync({ cwd: root }),
      ...new Bun.Glob('packages/ui/src/**/*.{ts,tsx}').scanSync({ cwd: root }),
    ];
    const violations = sourceFiles.flatMap((path) => {
      const contents = readFileSync(resolve(root, path), 'utf8');
      const matches = contents.match(productPaletteUtility) ?? [];

      return matches.map((match) => `${path}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
