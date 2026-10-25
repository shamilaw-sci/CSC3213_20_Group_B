import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('application shell contracts', () => {
  test('all applications use the shared skip-navigation primitive', () => {
    for (const app of ['web', 'people', 'projects', 'portal']) {
      const layout = source(`apps/${app}/src/app/layout.tsx`);

      expect(layout, app).toContain('@scs/ui/components/skip-link');
      expect(layout, app).toContain('<SkipLink');
      expect(layout, app).not.toContain('href="#main-content"');
    }
  });

  test('application headers preserve the shared visible focus indicator', () => {
    for (const app of ['web', 'people', 'projects']) {
      const header = source(
        `apps/${app}/src/components/layout/site-header.tsx`
      );
      expect(header, app).not.toContain('focus-visible:outline-none');
    }

    const portalHeader = source(
      'apps/portal/src/components/layout/portal-header.tsx'
    );
    expect(portalHeader, 'portal').not.toContain('focus-visible:outline-none');
  });

  test('headers with mobile navigation use the shared accessible sheet', () => {
    for (const app of ['web', 'people']) {
      const header = source(
        `apps/${app}/src/components/layout/site-header.tsx`
      );

      expect(header, app).toContain('@scs/ui/components/sheet');
      expect(header, app).toContain('<SheetContent');
      expect(header, app).toContain('<SheetTitle');
      expect(header, app).toMatch(
        /<SheetClose(?:\s+key=\{item\.href\})?\s+asChild>/u
      );
      expect(header, app).toContain('<ThemeToggle showLabel');
    }

    const portalHeader = source(
      'apps/portal/src/components/layout/portal-header.tsx'
    );
    expect(portalHeader).toContain('@scs/ui/components/sheet');
    expect(portalHeader).toContain('<SheetContent');
    expect(portalHeader).toContain('<SheetTitle');
    expect(portalHeader).toMatch(
      /<SheetClose(?:\s+key=\{item\.href\})?\s+asChild>/u
    );
    expect(portalHeader).toContain('<ThemeToggle showLabel');
  });

  test('Web provides a themed and zoom-accessible document shell', () => {
    const layout = source('apps/web/src/app/layout.tsx');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('<ThemeProvider>');
    expect(layout).toContain('<SkipLink');
    expect(layout).toContain('<SiteHeader');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain('<SiteFooter');
    expect(layout).not.toContain('maximumScale');
    expect(layout).not.toContain('userScalable');
  });

  test('Web navigation remains complete and keyboard accessible', () => {
    const header = source('apps/web/src/components/layout/site-header.tsx');

    for (const destination of [
      '/',
      '/about-us',
      '/undergraduate-courses',
      '/postgraduate-courses',
      '/research',
      '/people',
      '/contact',
    ]) {
      expect(header).toContain(`href: '${destination}'`);
    }

    expect(header).toContain('aria-label="Open navigation"');
    expect(header).toContain('<SheetContent');
    expect(header).toContain("aria-current={active ? 'page' : undefined}");
    expect(header).toContain('<ThemeToggle');
  });

  test('Web development feedback has an owned semantic composition', () => {
    expect(
      existsSync(
        resolve(root, 'apps/web/src/components/feedback/development-page.tsx')
      )
    ).toBe(true);
    expect(
      existsSync(
        resolve(root, 'apps/web/src/components/custom/dev-page/DevPage.tsx')
      )
    ).toBe(false);

    const home = source('apps/web/src/app/page.tsx');
    expect(home).toContain('@/components/feedback/development-page');
  });

  test('People provides a search-led themed document shell', () => {
    const layout = source('apps/people/src/app/layout.tsx');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('@scs/ui/components/theme-provider');
    expect(layout).toContain('<SkipLink');
    expect(layout).toContain('<SiteHeader');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain('<SiteFooter');
    expect(layout).not.toContain('maximumScale');
    expect(layout).not.toContain('userScalable');
  });

  test('People keeps search and top-level directory choices direct', () => {
    const header = source('apps/people/src/components/layout/site-header.tsx');

    for (const destination of ['/staff', '/students']) {
      expect(header).toContain(`href: '${destination}'`);
    }

    expect(header).toContain('<SheetContent');
    expect(header).toContain('aria-current={active');
    expect(header).toContain('hover:bg-accent');
    expect(header).toContain('<PeopleSearch');
    expect(header).toContain('<ThemeToggle');
    expect(header).toContain('aria-label="SCS People home"');
    expect(header).not.toContain('ChevronDown');
    expect(header).not.toContain('openMenu');
  });

  test('People search retains an explicit accessible label', () => {
    const search = source(
      'apps/people/src/components/search/people-search.tsx'
    );

    expect(search).toContain('aria-label="Search people"');
    expect(search).toContain("event.key === 'Escape'");
  });

  test('Projects provides a discovery-focused themed shell', () => {
    const layout = source('apps/projects/src/app/layout.tsx');
    const header = source(
      'apps/projects/src/components/layout/site-header.tsx'
    );

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('@scs/ui/components/theme-provider');
    expect(layout).toContain('<SkipLink');
    expect(layout).toMatch(/<main\s+id="main-content"/);
    expect(layout).not.toContain('maximumScale');
    expect(layout).not.toContain('userScalable');
    for (const legacyDestination of [
      '/search',
      '/find-by',
      '/courses',
      '/categories',
      '/topics',
    ]) {
      expect(header).not.toContain(legacyDestination);
    }

    expect(header).not.toContain('browseOpen');
    expect(header).not.toContain('Course-linked work');
    expect(header).toContain('href="/"');
    expect(header).toContain('aria-label="SCS Projects home"');
    expect(header).toContain('<ThemeToggle');
    expect(header).not.toContain('<SheetContent');
    expect(header).not.toContain('transition-all');
  });

  test('Portal navigation reports session-aware active destinations', () => {
    const header = source(
      'apps/portal/src/components/layout/portal-header.tsx'
    );

    expect(header).toContain("'use client';");
    expect(header).toContain('usePathname');
    expect(header).toContain('authClient.useSession()');
    expect(header).toContain('isNavigationItemActive');
    expect(header).toContain("aria-current={active ? 'page' : undefined}");
    expect(header).toContain('bg-accent text-accent-foreground');
  });
});
