import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dir, '../..');
const nativeFieldTags = new Set(['input', 'select', 'textarea']);

describe('form field identifiers', () => {
  test('gives every native JSX field an id or name for browser autofill', () => {
    const sourceFiles = [
      ...new Bun.Glob('apps/*/src/**/*.tsx').scanSync({ cwd: root }),
      ...new Bun.Glob('packages/ui/src/**/*.tsx').scanSync({ cwd: root }),
    ];
    const violations = sourceFiles.flatMap((path) => {
      const source = readFileSync(resolve(root, path), 'utf8');
      const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const fileViolations: string[] = [];

      function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tagName = node.tagName.getText(sourceFile);

          if (nativeFieldTags.has(tagName)) {
            const attributes = new Set(
              node.attributes.properties
                .filter(ts.isJsxAttribute)
                .map((attribute) => attribute.name.getText(sourceFile))
            );

            if (!attributes.has('id') && !attributes.has('name')) {
              const line =
                sourceFile.getLineAndCharacterOfPosition(
                  node.getStart(sourceFile)
                ).line + 1;
              fileViolations.push(`${path}:${line} <${tagName}>`);
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
      return fileViolations;
    });

    expect(violations).toEqual([]);
  });
});
