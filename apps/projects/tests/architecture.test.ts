import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(workspaceRoot, 'src');

function sourceFiles(extension: RegExp) {
  return readdirSync(sourceRoot, { recursive: true })
    .map(String)
    .filter((file) => extension.test(file))
    .map((file) => path.join(sourceRoot, file));
}

describe('Projects discovery architecture', () => {
  test('contains no legacy discovery routes or composed components', () => {
    for (const relativePath of [
      'src/app/find-by',
      'src/app/courses',
      'src/components/projects/facet-index.tsx',
      'src/components/projects/project-collection.tsx',
    ]) {
      expect(existsSync(path.join(workspaceRoot, relativePath))).toBe(false);
    }
  });

  test('contains no internal links to removed discovery routes', () => {
    const combinedSource = sourceFiles(/\.(?:ts|tsx)$/u)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    for (const legacyRoute of ['/find-by', '/courses']) {
      expect(combinedSource).not.toContain(legacyRoute);
    }
  });

  test('does not expose compatibility query or fetch helpers', () => {
    const apiClient = readFileSync(
      path.join(sourceRoot, 'lib/projects/api-client.ts'),
      'utf8'
    );
    const queries = readFileSync(
      path.join(sourceRoot, 'lib/projects/queries.ts'),
      'utf8'
    );

    for (const legacyExport of [
      'fetchProjectSearch',
      'fetchProjectsByUsername',
      'fetchCategories',
      'fetchTags',
      'fetchCourses',
      'getProjectsByCategory',
      'getProjectsByTag',
      'searchProjects',
      'getCategories',
      'getTags',
      'getCourses',
      'getProjectStats',
    ]) {
      expect(`${apiClient}\n${queries}`).not.toContain(legacyExport);
    }
  });

  test('uses category and topic consistently in user-facing Projects copy', () => {
    const userInterfaceSource = sourceFiles(/\.tsx$/u)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(userInterfaceSource).not.toMatch(/\bCollections?\b/u);
    expect(userInterfaceSource).not.toMatch(/\bTags?\b/u);
  });
});
