// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderAsync } from 'pele/lazy';

const docsRoot = join(import.meta.dirname, '../../../../docs');

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

const existingDiagrams = markdownFiles(docsRoot).flatMap((path) => {
  const markdown = readFileSync(path, 'utf8');
  return Array.from(
    markdown.matchAll(/^```mermaid\s*\r?\n([\s\S]*?)^```/gm),
    ([, source]) => ({
      path,
      source,
    })
  );
});

test('existing Mermaid fences render with Pele', async () => {
  expect(existingDiagrams.length).toBeGreaterThan(20);

  for (const { path, source } of existingDiagrams) {
    const result = await renderAsync(source);
    expect(result.svg, path).toContain('<svg');
  }
});

test.each([
  ['class', 'classDiagram\n  Animal <|-- Dog\n  Animal : +name'],
  ['entity relationship', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'],
])('%s diagrams render with Pele', async (_name, source) => {
  expect((await renderAsync(source)).svg).toContain('<svg');
});
