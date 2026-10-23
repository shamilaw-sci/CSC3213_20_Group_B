import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const portalRoot = resolve(import.meta.dir, '..');

function source(path: string) {
  return readFileSync(resolve(portalRoot, path), 'utf8');
}

describe('Portal application shell', () => {
  test('shows account actions that match the Better Auth session', () => {
    const header = source('src/components/layout/portal-header.tsx');

    expect(header).toContain('authClient.useSession()');
    expect(header).toContain('isPending');
    expect(header).toContain("{ href: '/login', label: 'Sign in' }");
    expect(header).toContain("{ href: '/signup', label: 'Create account' }");
    expect(header).toContain("{ href: '/dashboard', label: 'Dashboard' }");
    expect(header).toContain("{ href: '/user/me', label: 'Account' }");
    expect(header).toContain('<LogoutButton');
    expect(header).toContain('<ThemeToggle');
    expect(header).not.toContain('/admin');
  });

  test('marks active destinations and groups account routes', () => {
    const header = source('src/components/layout/portal-header.tsx');

    expect(header).toContain('usePathname');
    expect(header).toContain('isNavigationItemActive');
    expect(header).toContain("pathname.startsWith('/account/')");
    expect(header).toContain("aria-current={active ? 'page' : undefined}");
    expect(header.match(/<PortalNavigationLink/gu)?.length).toBe(2);
  });

  test('removes signed-out calls to action from the signed-in home state', () => {
    const home = source('src/app/_components/portal-home.tsx');

    expect(home).toContain('authClient.useSession()');
    expect(home).toContain("href={session?.user ? '/dashboard' : '/login'}");
    expect(home).toContain("session?.user ? 'Open dashboard' : 'Sign in'");
    expect(home).toContain('!isPending && !session?.user');
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
