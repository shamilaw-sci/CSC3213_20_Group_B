import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('application shell contracts', () => {
  test('Web provides a themed and zoom-accessible document shell', () => {
    const layout = source('apps/web/src/app/layout.tsx');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('<ThemeProvider>');
    expect(layout).toContain('href="#main-content"');
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
    expect(header).toContain('focus-visible:');
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

    const views = source('apps/web/src/views/home/Home.tsx');
    expect(views).toContain('@/components/feedback/development-page');
  });

  test('People provides a search-led themed document shell', () => {
    const layout = source('apps/people/src/app/layout.tsx');

    expect(layout).toContain("import '@scs/ui/styles/theme.css';");
    expect(layout).toContain('@scs/ui/components/theme-provider');
    expect(layout).toContain('href="#main-content"');
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
    expect(layout).toContain('href="#main-content"');
    expect(layout).toMatch(/<main\s+id="main-content"/);
    expect(layout).not.toContain('maximumScale');
    expect(layout).not.toContain('userScalable');
    expect(header).toContain('aria-expanded={browseOpen}');
    expect(header).toContain("event.key === 'Escape'");
    expect(header).toContain('max-h-[min(24rem,calc(100vh-6rem))]');
    expect(header).not.toContain('transition-all');
  });
});
