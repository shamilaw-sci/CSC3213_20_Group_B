import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const apps = ['web', 'people', 'projects', 'portal', 'docs'] as const;
const fallbackFiles = [
  'error.tsx',
  'global-error.tsx',
  'not-found.tsx',
  'global-not-found.tsx',
] as const;

function fallbackPath(app: (typeof apps)[number], file: string) {
  return resolve(root, `apps/${app}/src/app/${file}`);
}

function applicationSource(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('Next.js application fallback contracts', () => {
  for (const app of apps) {
    test(`${app} owns the complete fallback hierarchy`, () => {
      for (const file of fallbackFiles) {
        expect(existsSync(fallbackPath(app, file))).toBe(true);
      }
    });

    test(`${app} segment errors remain retryable client boundaries`, () => {
      const source = readFileSync(fallbackPath(app, 'error.tsx'), 'utf8');

      expect(source.startsWith("'use client';")).toBe(true);
      expect(source).toContain('reset: () => void');
      expect(source).toContain('<ErrorPageFlag');
      expect(source).toContain('<FeedbackState');
    });

    test(`${app} root fallbacks render standalone themed documents`, () => {
      for (const file of ['global-error.tsx', 'global-not-found.tsx']) {
        const source = readFileSync(fallbackPath(app, file), 'utf8');

        expect(source).toContain("import '@scs/ui/styles/theme.css';");
        expect(source).toContain("import '@/app/globals.css';");
        expect(source).toContain('<html');
        expect(source).toContain('<body');
        expect(source).toContain('<ThemeInitScript');
        expect(source).toContain('<FeedbackState');
      }
    });

    test(`${app} missing records use the shared feedback contract`, () => {
      const source = readFileSync(fallbackPath(app, 'not-found.tsx'), 'utf8');

      expect(source).toContain('<ErrorPageFlag');
      expect(source).toContain('<FeedbackState');
    });
  }

  test('fallbacks no longer depend on duplicated app-local theme helpers', () => {
    for (const app of apps) {
      for (const file of fallbackFiles) {
        const source = readFileSync(fallbackPath(app, file), 'utf8');
        expect(source).not.toContain('@/components/custom/theme/');
      }
    }
  });

  test('public entity routes terminate confirmed missing records with notFound', () => {
    const guardedSources = [
      'apps/projects/src/app/projects/[project_slug]/page.tsx',
      'apps/people/src/app/people/[identity]/page.tsx',
      'apps/people/src/app/students/computer-science/[batch]/page.tsx',
      'apps/people/src/app/students/data-science/[batch]/page.tsx',
      'apps/people/src/app/students/statistics/[batch]/page.tsx',
      'apps/portal/src/lib/server/course-editor.ts',
      'apps/portal/src/lib/server/project-editor.ts',
      'apps/portal/src/lib/server/user.ts',
    ];

    for (const path of guardedSources) {
      expect(applicationSource(path), path).toContain('notFound()');
    }
  });

  test('project collection routes validate published collections and page bounds', () => {
    const collectionRoutes = [
      'apps/projects/src/app/browse/[[...segments]]/page.tsx',
      'apps/projects/src/app/categories/[category]/[[...segments]]/page.tsx',
      'apps/projects/src/app/search/[query]/[[...segments]]/page.tsx',
      'apps/projects/src/app/topics/[topic]/[[...segments]]/page.tsx',
      'apps/projects/src/app/types/[type]/[[...segments]]/page.tsx',
    ];

    for (const path of collectionRoutes) {
      const source = applicationSource(path);
      expect(source, path).toContain('requireProjectCollectionPage(');
      expect(source, path).toContain('projects={projects}');
    }
  });

  test('admin user subpages validate the dynamic user before rendering', () => {
    for (const path of [
      'apps/portal/src/app/admin/users/[email]/public-profile/page.tsx',
      'apps/portal/src/app/admin/users/[email]/settings/page.tsx',
    ]) {
      expect(applicationSource(path), path).toContain(
        'await loadAdminUser(targetEmail)'
      );
    }
  });

  test('entity notFound calls retain their nearest route-specific fallback', () => {
    const routeFallbacks = [
      'apps/projects/src/app/projects/[project_slug]/not-found.tsx',
      'apps/projects/src/app/browse/not-found.tsx',
      'apps/projects/src/app/categories/[category]/not-found.tsx',
      'apps/projects/src/app/search/[query]/not-found.tsx',
      'apps/projects/src/app/topics/[topic]/not-found.tsx',
      'apps/projects/src/app/types/[type]/not-found.tsx',
      'apps/people/src/app/people/[identity]/not-found.tsx',
      'apps/people/src/app/students/computer-science/[batch]/not-found.tsx',
      'apps/people/src/app/students/data-science/[batch]/not-found.tsx',
      'apps/people/src/app/students/statistics/[batch]/not-found.tsx',
      'apps/portal/src/app/academic/courses/[course]/not-found.tsx',
      'apps/portal/src/app/user/projects/[project]/not-found.tsx',
      'apps/portal/src/app/admin/projects/[project]/not-found.tsx',
      'apps/portal/src/app/admin/users/[email]/not-found.tsx',
    ];

    for (const path of routeFallbacks) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  test('People routes that validate remote records remain dynamic', () => {
    for (const path of [
      'apps/people/src/app/people/[identity]/page.tsx',
      'apps/people/src/app/students/computer-science/[batch]/page.tsx',
      'apps/people/src/app/students/data-science/[batch]/page.tsx',
      'apps/people/src/app/students/statistics/[batch]/page.tsx',
    ]) {
      const source = applicationSource(path);
      expect(source, path).toContain("export const dynamic = 'force-dynamic';");
      expect(source, path).not.toContain('generateStaticParams');
    }
  });
});
