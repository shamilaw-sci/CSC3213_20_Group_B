import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../../src');

function source(path: string) {
  return readFileSync(resolve(sourceRoot, path), 'utf8');
}

describe('documentation accessibility contracts', () => {
  test('uses the Fumadocs shell for navigation and search', () => {
    const layout = source('app/layout.tsx');

    expect(layout).not.toContain('SkipLink');
    expect(layout).toContain("type: 'static'");
    expect(layout).toContain('<RootProvider');
  });

  test('loads the shared theme and scans shared UI components', () => {
    const layout = source('app/layout.tsx');
    const styles = source('app/globals.css');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(styles).toContain("@source '../../../../packages/ui/src';");
    expect(styles).toContain('--color-fd-background: var(--background);');
    expect(styles).toContain('--color-primary: var(--primary);');
  });

  test('keeps scrolling stable without forcing fitting pages to scroll', () => {
    const styles = source('app/globals.css');

    expect(styles).toContain('scrollbar-gutter: stable;');
    expect(styles).toContain('scrollbar-color:');
    expect(styles).toContain('var(--muted-foreground)');
    expect(styles).toContain('::-webkit-scrollbar-thumb');
    expect(styles).not.toContain('overflow-y: scroll;');
  });

  test('moves search focus from the raw input to its rounded container', () => {
    const styles = source('app/globals.css');

    expect(styles).toContain("input[role='combobox']:focus-visible");
    expect(styles).toContain(':focus-within');
    expect(styles).toContain('border-radius:');
    expect(styles).toContain('var(--ring)');
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
