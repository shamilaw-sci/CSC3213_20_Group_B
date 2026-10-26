import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../../src');

function source(path: string) {
  return readFileSync(resolve(sourceRoot, path), 'utf8');
}

describe('documentation accessibility contracts', () => {
  test('exposes skip navigation, static search, and theme support', () => {
    const layout = source('app/layout.tsx');

    expect(layout).toContain('<SkipLink');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain("type: 'static'");
    expect(layout).toContain('<RootProvider');
  });

  test('uses semantic theme utilities instead of literal palette colors', () => {
    const files = [
      'components/layout/docs-home.tsx',
      'app/error.tsx',
      'app/not-found.tsx',
      'app/global-error.tsx',
      'app/global-not-found.tsx',
    ];

    for (const file of files) {
      expect(source(file), file).not.toMatch(
        /(?:bg|text|border|ring)-(?:red|blue|green|gray|slate|zinc|neutral|stone|amber|yellow|orange|purple|pink)-\d+/u
      );
    }
  });
});
