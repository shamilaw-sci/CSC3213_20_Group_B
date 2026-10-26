import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteHeader } from '@/components/layout/site-header';

let pathname = '/research';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('SiteHeader', () => {
  beforeEach(() => {
    pathname = '/research';
  });

  test('identifies the department home link', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: 'SCS department home' })
    ).toHaveAttribute('href', '/');
  });

  test('marks the current department route in desktop and mobile navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await user.click(
      screen.getByRole('button', { name: 'Open department navigation' })
    );

    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('provides an accessible mobile navigation trigger', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('button', { name: 'Open department navigation' })
    ).toBeInTheDocument();
  });

  test('keeps secondary destinations globally reachable and marks local routes active', async () => {
    const user = userEvent.setup();
    pathname = '/services';
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('link', { name: /project showcase/i })
    ).toHaveAttribute('href', '/projects');
  });
});
