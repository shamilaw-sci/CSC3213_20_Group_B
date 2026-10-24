import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

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
  test('keeps every discovery destination directly visible on desktop', () => {
    render(<SiteHeader />);

    for (const label of [
      'Search',
      'People',
      'Courses',
      'Categories',
      'Topics',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole('link', { name: 'SCS Projects home' })
    ).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse' })).toBeNull();
  });

  test('keeps all discovery destinations in the mobile menu', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Explore projects' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();

    for (const label of [
      'Search',
      'People',
      'Courses',
      'Categories',
      'Topics',
    ]) {
      expect(
        screen.getAllByRole('link', { name: new RegExp(`^${label}$`) }).length
      ).toBeGreaterThan(0);
    }

    await user.click(screen.getByRole('link', { name: /^Search$/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
