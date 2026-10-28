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

  test('reserves one scrollbar gutter and locks the page behind search', () => {
    const styles = source('app/globals.css');

    expect(styles).toContain('scrollbar-gutter: stable;');
    expect(styles).toContain('scrollbar-color:');
    expect(styles).toContain('var(--muted-foreground)');
    expect(styles).toContain('::-webkit-scrollbar-thumb');
    expect(styles).toContain('html:has(body[data-scroll-locked])');
    expect(styles).toContain('overflow: hidden;');
    expect(styles).not.toContain('scrollbar-gutter: auto;');
    expect(styles).toMatch(
      /html body\[data-scroll-locked\]\s*\{[^}]*margin-right:\s*0\s*!important;/su
    );
    expect(styles).not.toContain('position: static !important;');
    expect(styles).not.toContain('scrollbar-gutter: stable both-edges;');
    expect(styles).not.toContain('overflow-y: auto !important;');
    expect(styles).not.toContain('overflow-y: scroll;');
  });

  test('uses a neutral divider focus treatment inside the search dialog', () => {
    const styles = source('app/globals.css');

    expect(styles).toContain("input[role='combobox']:focus-visible");
    expect(styles).toContain(':focus-within');
    expect(styles).toContain('box-shadow: inset 0 -2px 0');
    expect(styles).toContain('var(--foreground)');
    expect(styles).not.toContain('box-shadow: inset 0 0 0 2px var(--ring);');
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
