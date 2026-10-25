import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { SiteHeader } from '@/components/layout/site-header';

let currentPath = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
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
  beforeEach(() => {
    currentPath = '/';
  });

  test('keeps Home and Browse visible without a redundant mobile menu', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: 'SCS Projects home' })
    ).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute(
      'href',
      '/browse'
    );
    expect(
      screen.queryByRole('button', { name: 'Open navigation' })
    ).toBeNull();

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

  test('marks Browse current for every directory path', () => {
    currentPath = '/categories/research';
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current'
    );
  });
});
