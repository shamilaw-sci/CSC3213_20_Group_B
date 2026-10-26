import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve(import.meta.dirname, '..', 'src');

describe('Web style contract', () => {
  test('keeps literal colors out of TSX and MDX components', async () => {
    const entries = await readdir(sourceRoot, { recursive: true });
    const componentFiles = entries.filter(
      (entry) => entry.endsWith('.tsx') || entry.endsWith('.mdx')
    );

    for (const entry of componentFiles) {
      const source = await readFile(path.join(sourceRoot, entry), 'utf8');

      expect(source, entry).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(source, entry).not.toMatch(
        /(?:bg|border|fill|outline|ring|stroke|text)-\[(?:#|hsl|oklch|rgb)/i
      );
    }
  });
});
