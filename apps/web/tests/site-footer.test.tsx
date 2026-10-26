import { render, screen } from '@testing-library/react';

import { SiteFooter } from '@/components/layout/site-footer';

describe('SiteFooter', () => {
  test('preserves the shared visible keyboard focus treatment', () => {
    render(<SiteFooter />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveClass('focus-visible:outline-none');
    }
  });
});
