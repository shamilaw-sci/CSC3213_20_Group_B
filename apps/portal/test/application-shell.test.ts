import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const portalRoot = resolve(import.meta.dir, '..');

function source(path: string) {
  return readFileSync(resolve(portalRoot, path), 'utf8');
}

describe('Portal application shell', () => {
  test('keeps universally safe destinations in the root header', () => {
    const header = source('src/components/layout/portal-header.tsx');

    expect(header).toContain("{ href: '/', label: 'Portal home' }");
    expect(header).toContain("{ href: '/login', label: 'Sign in' }");
    expect(header).toContain('<Link');
    expect(header).toContain('<ThemeToggle');
    expect(header).not.toContain('/admin');
  });

  test('marks the exact active public destination in both navigation layouts', () => {
    const header = source('src/components/layout/portal-header.tsx');

    expect(header).toContain('usePathname');
    expect(header).toContain('pathname === item.href');
    expect(header).toContain("aria-current={active ? 'page' : undefined}");
    expect(header.match(/<PortalNavigationLink/gu)?.length).toBe(2);
  });

  test('uses the shared theme without a floating global control', () => {
    const layout = source('src/app/layout.tsx');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('@scs/ui/components/theme-provider');
    expect(layout).toContain('<PortalHeader');
    expect(layout).toContain('id="main-content"');
    expect(layout).not.toContain('<ThemeToggle');
    expect(layout).not.toContain('maximumScale');
    expect(layout).not.toContain('userScalable');
  });

  test('keeps permission-specific workspace links behind role helpers', () => {
    const dashboard = source('src/app/dashboard/_components/dashboard.tsx');

    expect(dashboard).toContain('isSuperAdminRole');
    expect(dashboard).toContain('canEditCoursesRole');
    expect(dashboard).toContain("href: '/admin'");
    expect(dashboard).toContain("href: '/academic/courses'");
  });

  test('moves touched shell compositions out of custom and views', () => {
    expect(
      existsSync(resolve(portalRoot, 'src/components/layout/page-shell.tsx'))
    ).toBe(true);
    expect(
      existsSync(
        resolve(portalRoot, 'src/components/custom/page-shell/page-shell.tsx')
      )
    ).toBe(false);

    const applicationSource = source('src/app/admin/page.tsx');
    expect(applicationSource).toContain(
      '@/app/admin/_components/admin-overview'
    );

    for (const path of [
      'src/app/_components/portal-home.tsx',
      'src/app/dashboard/_components/dashboard.tsx',
      'src/app/admin/_components/admin-overview.tsx',
    ]) {
      expect(existsSync(resolve(portalRoot, path))).toBe(true);
    }
  });
});
