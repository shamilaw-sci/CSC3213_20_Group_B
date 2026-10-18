import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Badge, badgeVariants } from '../src/components/badge';
import { buttonVariants } from '../src/components/button';
import { Card } from '../src/components/card';
import { Toaster } from '../src/components/sonner';
import { Tabs, TabsList, TabsTrigger } from '../src/components/tabs';

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
});
