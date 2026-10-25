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

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function themeTokens(css: string, selector: ':root' | '.dark') {
  const block = css.match(
    new RegExp(
      `${selector === ':root' ? ':root' : '\\.dark'}\\s*\\{([\\s\\S]*?)\\}`,
      'u'
    )
  )?.[1];
  if (!block) throw new Error(`Missing ${selector} theme block`);

  return Object.fromEntries(
    Array.from(block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/giu)).map(
      ([, name, value]) => [name, value]
    )
  );
}

describe('shared UI component contracts', () => {
  test('renders one reusable skip link with a stable default target', async () => {
    const modulePath = resolve(
      import.meta.dir,
      '../src/components/skip-link.tsx'
    );
    expect(existsSync(modulePath)).toBe(true);

    const { SkipLink } = await import('@scs/ui/components/skip-link');
    const markup = renderToStaticMarkup(
      <SkipLink className="custom-skip" data-test="skip" />
    );

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('>Skip to main content<');
    expect(markup).toContain('custom-skip');
    expect(markup).toContain('data-test="skip"');
    expect(markup).toContain('focus-visible:translate-y-0');
  });

  test('limits shared control transitions to explicit properties', () => {
    for (const path of [
      '../src/components/switch.tsx',
      '../src/components/tabs.tsx',
    ]) {
      const source = readFileSync(resolve(import.meta.dir, path), 'utf8');
      expect(source).not.toContain('transition-all');
    }
  });

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
    expect(buttonVariants({ variant: 'ghost' })).toContain(
      'hover:text-accent-foreground'
    );
    expect(buttonVariants({ variant: 'ghost' })).toContain('active:bg-accent');
    expect(buttonVariants({ variant: 'ghost' })).not.toContain('dark:hover');
  });

  test('exports an accessible sheet primitive for mobile navigation', async () => {
    const modulePromise = import('@scs/ui/components/sheet');
    await expect(modulePromise).resolves.toBeDefined();
    const { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } =
      await modulePromise;

    for (const component of [
      Sheet,
      SheetClose,
      SheetContent,
      SheetTitle,
      SheetTrigger,
    ]) {
      expect(typeof component).toBe('function');
    }
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

  test('exports a semantic skeleton primitive with customizable geometry', async () => {
    const modulePromise = import('@scs/ui/components/skeleton');
    await expect(modulePromise).resolves.toBeDefined();
    const { Skeleton } = await modulePromise;
    const markup = renderToStaticMarkup(
      <Skeleton className="custom-skeleton h-8" />
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('animate-pulse');
    expect(markup).toContain('bg-muted');
    expect(markup).toContain('custom-skeleton');
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
    expect(iconOnly).toContain('data-variant="outline"');
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
      '--destructive-foreground',
      '--destructive-surface',
      '--destructive-surface-foreground',
      '--destructive-border',
      '--success',
      '--success-foreground',
      '--success-surface',
      '--success-surface-foreground',
      '--success-border',
      '--warning',
      '--warning-foreground',
      '--warning-surface',
      '--warning-surface-foreground',
      '--warning-border',
      '--info',
      '--info-foreground',
      '--info-surface',
      '--info-surface-foreground',
      '--info-border',
      '--border',
      '--input',
      '--ring',
      '--overlay',
      '--sidebar',
    ]) {
      expect(css.match(new RegExp(`${token}:`, 'gu'))?.length).toBe(2);
    }
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('color-scheme: dark');
  });

  test('semantic text and focus colors meet WCAG contrast targets', () => {
    const css = readFileSync(
      resolve(import.meta.dir, '../src/styles/theme.css'),
      'utf8'
    );
    const pairs = [
      ['background', 'foreground'],
      ['card', 'card-foreground'],
      ['popover', 'popover-foreground'],
      ['primary', 'primary-foreground'],
      ['secondary', 'secondary-foreground'],
      ['muted', 'muted-foreground'],
      ['accent', 'accent-foreground'],
      ['destructive', 'destructive-foreground'],
      ['destructive-surface', 'destructive-surface-foreground'],
      ['success', 'success-foreground'],
      ['success-surface', 'success-surface-foreground'],
      ['warning', 'warning-foreground'],
      ['warning-surface', 'warning-surface-foreground'],
      ['info', 'info-foreground'],
      ['info-surface', 'info-surface-foreground'],
      ['sidebar', 'sidebar-foreground'],
    ] as const;

    for (const selector of [':root', '.dark'] as const) {
      const tokens = themeTokens(css, selector);
      for (const [background, foreground] of pairs) {
        expect(
          contrastRatio(tokens[background]!, tokens[foreground]!),
          `${selector} ${foreground} on ${background}`
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrastRatio(tokens.background!, tokens.ring!),
        `${selector} focus ring on background`
      ).toBeGreaterThanOrEqual(3);
    }
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
