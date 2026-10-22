import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Badge, badgeVariants } from '@scs/ui/components/badge';
import { buttonVariants } from '@scs/ui/components/button';
import { Card } from '@scs/ui/components/card';
import { Toaster } from '@scs/ui/components/sonner';
import { Tabs, TabsList, TabsTrigger } from '@scs/ui/components/tabs';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

function runThemeInit({
  script,
  storedTheme,
  systemDark,
  storageFails = false,
}: {
  script: string;
  storedTheme: string | null;
  systemDark: boolean;
  storageFails?: boolean;
}) {
  const classes = new Set<string>();
  const listeners = new Map<string, (...args: never[]) => void>();
  const document = {
    documentElement: {
      classList: {
        toggle(name: string, enabled: boolean) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
      },
    },
  };
  const mediaQuery = {
    matches: systemDark,
    addEventListener() {},
  };
  const window = {
    matchMedia: () => mediaQuery,
    addEventListener(event: string, listener: (...args: never[]) => void) {
      listeners.set(event, listener);
    },
  };
  const localStorage = {
    getItem() {
      if (storageFails) throw new Error('storage unavailable');
      return storedTheme;
    },
  };

  Function(
    'document',
    'window',
    'localStorage',
    script
  )(document, window, localStorage);

  return classes;
}

describe('shared UI component contracts', () => {
  test('preserves badge variants and custom classes', () => {
    expect(badgeVariants({ variant: 'outline' })).toContain('border-border');
    expect(renderToStaticMarkup(<Badge className="custom" />)).toContain(
      'custom'
    );
  });

  test('preserves the migrated card geometry', () => {
    expect(renderToStaticMarkup(<Card />)).toContain('rounded-xl');
  });

  test('preserves the canonical button variants', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border');
  });

  test('preserves the people-specific tab styling as an explicit variant', () => {
    const markup = renderToStaticMarkup(
      <Tabs defaultValue="one">
        <TabsList variant="brand">
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(markup).toContain('data-variant="brand"');
    expect(markup).toContain('group-data-[variant=brand]/tabs-list');
  });

  test('exports the shared toaster component', () => {
    expect(typeof Toaster).toBe('function');
  });

  test('renders feedback with one semantic heading and caller actions', async () => {
    const modulePromise = import('@scs/ui/components/feedback-state');
    await expect(modulePromise).resolves.toBeDefined();
    const { FeedbackState } = await modulePromise;
    const markup = renderToStaticMarkup(
      <FeedbackState
        code="404"
        title="Page not found"
        description="Check the address and try again."
        actions={<a href="/">Return home</a>}
      />
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('Page not found');
    expect(markup).toContain('Check the address and try again.');
    expect(markup).toContain('href="/"');
  });

  test('uses hydration-safe theme-provider defaults', async () => {
    const modulePromise = import('@scs/ui/components/theme-provider');
    await expect(modulePromise).resolves.toBeDefined();
    const { THEME_PROVIDER_DEFAULTS, ThemeProvider } = await modulePromise;
    expect(THEME_PROVIDER_DEFAULTS).toEqual({
      attribute: 'class',
      defaultTheme: 'system',
      enableSystem: true,
      disableTransitionOnChange: true,
    });
    expect(
      renderToStaticMarkup(
        <ThemeProvider>
          <div>Content</div>
        </ThemeProvider>
      )
    ).toContain('Content');
  });

  test('renders stable accessible theme-toggle copy with an optional label', async () => {
    const modulePromise = import('@scs/ui/components/theme-toggle');
    await expect(modulePromise).resolves.toBeDefined();
    const { ThemeToggle } = await modulePromise;
    const iconOnly = renderToStaticMarkup(<ThemeToggle />);
    const labeled = renderToStaticMarkup(<ThemeToggle showLabel />);

    expect(iconOnly).toContain('aria-label="Toggle color theme"');
    expect(iconOnly).not.toContain('>Theme<');
    expect(labeled).toContain('>Theme<');
  });

  test('initializes stored and system themes even when storage is unavailable', async () => {
    const modulePromise = import('@scs/ui/components/theme-init-script');
    await expect(modulePromise).resolves.toBeDefined();
    const { THEME_INIT_SCRIPT } = await modulePromise;

    expect(
      runThemeInit({
        script: THEME_INIT_SCRIPT,
        storedTheme: 'dark',
        systemDark: false,
      }).has('dark')
    ).toBe(true);
    expect(
      runThemeInit({
        script: THEME_INIT_SCRIPT,
        storedTheme: 'light',
        systemDark: true,
      }).has('dark')
    ).toBe(false);
    expect(
      runThemeInit({
        script: THEME_INIT_SCRIPT,
        storedTheme: null,
        systemDark: true,
      }).has('dark')
    ).toBe(true);
    expect(
      runThemeInit({
        script: THEME_INIT_SCRIPT,
        storedTheme: null,
        systemDark: true,
        storageFails: true,
      }).has('dark')
    ).toBe(true);
  });

  test('exports complete light and dark semantic theme tokens', () => {
    const stylesheet = resolve(import.meta.dir, '../src/styles/theme.css');
    expect(existsSync(stylesheet)).toBe(true);
    const css = readFileSync(stylesheet, 'utf8');

    for (const token of [
      '--background',
      '--foreground',
      '--card',
      '--popover',
      '--primary',
      '--secondary',
      '--muted',
      '--accent',
      '--border',
      '--input',
      '--ring',
      '--sidebar',
    ]) {
      expect(css.match(new RegExp(`${token}:`, 'gu'))?.length).toBe(2);
    }
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('color-scheme: dark');
  });

  test('publishes the semantic theme stylesheet as a package export', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(import.meta.dir, '../package.json'), 'utf8')
    ) as { exports: Record<string, string>; sideEffects: string[] };

    expect(packageJson.exports['./styles/theme.css']).toBe(
      './src/styles/theme.css'
    );
    expect(packageJson.sideEffects).toContain('**/*.css');
  });
});
