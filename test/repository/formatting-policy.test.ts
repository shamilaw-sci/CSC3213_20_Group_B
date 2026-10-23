import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

interface RootManifest {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  prettier?: Record<string, unknown>;
}

const manifest = JSON.parse(
  readFileSync('package.json', 'utf8')
) as RootManifest;

describe('repository formatting and dead-code policy', () => {
  test('matches the sivothayan.com Tailwind-aware Prettier configuration', () => {
    expect(manifest.prettier).toEqual({
      printWidth: 80,
      classnamesPrintWidth: 80,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      bracketSpacing: true,
      arrowParens: 'always',
      endOfLine: 'auto',
      plugins: [
        'prettier-plugin-tailwindcss',
        'prettier-plugin-classnames',
        'prettier-plugin-merge',
      ],
      overrides: [
        {
          files: '*.jsonc',
          options: {
            trailingComma: 'none',
          },
        },
      ],
    });

    expect(manifest.devDependencies['prettier-plugin-tailwindcss']).toBe(
      '^0.8.1'
    );
    expect(manifest.devDependencies['prettier-plugin-classnames']).toBe(
      '^0.10.4'
    );
    expect(manifest.devDependencies['prettier-plugin-merge']).toBe('^0.10.1');
    expect(existsSync('prettier.config.mts')).toBeFalse();
  });

  test('provides one root Knip verification command', () => {
    expect(manifest.scripts.knip).toBe('turbo knip');

    const turbo = JSON.parse(readFileSync('turbo.json', 'utf8')) as {
      tasks: Record<string, unknown>;
    };
    expect(turbo.tasks.knip).toEqual({ dependsOn: ['^knip'] });
  });
});
