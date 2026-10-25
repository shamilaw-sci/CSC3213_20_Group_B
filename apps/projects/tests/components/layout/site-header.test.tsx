import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ onClick, ...props }: ComponentProps<'a'>) => (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    />
  ),
}));

vi.mock('@scs/ui/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('Projects SiteHeader', () => {
  test('keeps the global shell focused on home and theme', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: 'SCS Projects home' })
    ).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open navigation' })
    ).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();

    for (const label of [
      'Search',
      'People',
      'Courses',
      'Categories',
      'Topics',
    ]) {
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });
});

describe('Projects SiteFooter', () => {
  test('links only to canonical discovery URLs', () => {
    render(<SiteFooter />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/?category=research',
      '/?type=COURSE_PROJECT',
      '/?status=ACTIVE',
    ]);
    expect(links.some((link) => link.getAttribute('href') === '/search')).toBe(
      false
    );
  });
});
