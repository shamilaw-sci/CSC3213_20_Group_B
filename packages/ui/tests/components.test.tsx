import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Badge, badgeVariants } from '../src/components/badge';
import { Card } from '../src/components/card';
import { Toaster } from '../src/components/sonner';

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

  test('exports the shared toaster component', () => {
    expect(typeof Toaster).toBe('function');
  });
});
