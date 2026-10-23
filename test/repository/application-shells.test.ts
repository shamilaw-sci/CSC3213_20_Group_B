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

    expect(header).toContain("'Close navigation' : 'Open navigation'");
    expect(header).toContain('aria-expanded={menuOpen}');
    expect(header).toContain("event.key === 'Escape'");
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

  test('People disclosures and mobile navigation expose every destination', () => {
    const header = source('apps/people/src/components/layout/site-header.tsx');

    for (const destination of [
      '/staff',
      '/staff/academic',
      '/staff/academic-support',
      '/staff/non-academic',
      '/students',
      '/students/computer-science',
      '/students/data-science',
      '/students/statistics',
    ]) {
      expect(header).toContain(`href: '${destination}'`);
    }

    expect(header).toContain('aria-expanded={openMenu === menu.id}');
    expect(header).toContain("event.key === 'Escape'");
    expect(header).toContain('pointerdown');
    expect(header).toContain('aria-current={active');
    expect(header).toContain('border-l-2');
    expect(header).toContain('<PeopleSearch');
    expect(header).toContain('<ThemeToggle');
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
    expect(header).toContain('aria-expanded={browseOpen}');
    expect(header).toContain("event.key === 'Escape'");
    expect(header).toContain('max-h-[min(24rem,calc(100vh-6rem))]');
    expect(header).not.toContain('transition-all');
  });

  test('Portal navigation reports the exact active public destination', () => {
    const header = source(
      'apps/portal/src/components/layout/portal-header.tsx'
    );

    expect(header).toContain("'use client';");
    expect(header).toContain('usePathname');
    expect(header).toContain('pathname === item.href');
    expect(header).toContain("aria-current={active ? 'page' : undefined}");
    expect(header).toContain('border-primary');
  });
});
