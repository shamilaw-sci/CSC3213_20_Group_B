import { render, screen } from '@testing-library/react';
import { FrameworkProvider } from 'fumadocs-core/framework';
import { describe, expect, test, vi } from 'vitest';

import { DocsSearchDialog } from '@/components/search/docs-search-dialog';

describe('documentation search dialog', () => {
  test('identifies its search field for browser autofill', async () => {
    render(
      <FrameworkProvider
        useParams={() => ({})}
        usePathname={() => '/'}
        useRouter={() => ({ push() {}, refresh() {} })}
      >
        <DocsSearchDialog open onOpenChange={vi.fn()} />
      </FrameworkProvider>
    );

    expect(
      await screen.findByRole('combobox', { name: 'Search' })
    ).toHaveAttribute('id', 'docs-search-input');
  });
});
