import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteHeader } from '@/components/layout/site-header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
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
  });
});
